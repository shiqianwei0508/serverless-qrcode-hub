// Data layer: schema/migration, input validation, and all CRUD / cleanup
// operations against the D1 database.
//
// `DB` is a live binding imported from state.js; it is populated by
// initState(env) before any of these functions run.
import { DB } from './state.js';

// Short-link paths that are reserved and must never be stored as mappings
// (they collide with the admin dashboard, static assets, or meta endpoints).
const banPath = [
  'login', 'admin', '__total_count',
  // static files
  'admin.html', 'login.html',
  'daisyui@5.css', 'tailwindcss@4.js',
  'qr-code-styling.js', 'zxing.js',
  'robots.txt', 'wechat.svg',
  'favicon.svg',
];

// Input limits — mirror the frontend rules so the API cannot be bypassed by
// calling it directly (the frontend only checks format; the backend must too).
const PATH_MAX = 64;
const NAME_MAX = 128;
const TARGET_MAX = 2048;
// WeChat live-code image data (a data:image/ URL) must stay within D1's safe
// per-row size budget. 1 MiB base64 is ~1.4 MB of text, well under the limit.
const QR_MAX = 1048576;
const PATH_RE = /^[a-zA-Z0-9-_]+$/;

// Database initialization
let dbInitialized = false;
async function initDatabase() {
  // Idempotent across requests within the same isolate: the schema/migration
  // is created once, so subsequent requests skip the DDL round-trips.
  if (dbInitialized) return;
  dbInitialized = true;

  // Create table
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS mappings (
      path TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      name TEXT,
      expiry TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT
    )
  `).run();

  // Check whether new columns need to be added
  const tableInfo = await DB.prepare("PRAGMA table_info(mappings)").all();
  const columns = tableInfo.results.map(col => col.name);

  // Add isWechat column if it does not exist
  if (!columns.includes('isWechat')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN isWechat INTEGER DEFAULT 0
    `).run();
  }

  // Add qrCodeData column if it does not exist
  if (!columns.includes('qrCodeData')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN qrCodeData TEXT
    `).run();
  }

  // Add pinned column if it does not exist (used for global pinning)
  if (!columns.includes('pinned')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN pinned INTEGER DEFAULT 0
    `).run();
  }

  // Add indexes
  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_expiry ON mappings(expiry)
  `).run();

  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON mappings(created_at)
  `).run();

  // Composite index for enabled-status + expiry lookups
  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_enabled_expiry ON mappings(enabled, expiry)
  `).run();

  // Data migration: convert legacy date strings to millisecond timestamps
  // Step 1: migrate expiry (YYYY-MM-DD -> ms timestamp)
  const oldExpiryCount = await DB.prepare(`
    SELECT COUNT(*) as cnt FROM mappings 
    WHERE expiry IS NOT NULL AND expiry GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  `).first();
  if (oldExpiryCount && oldExpiryCount.cnt > 0) {
    console.log(`Migrating ${oldExpiryCount.cnt} expiry values from date string to timestamp...`);
    const rows = await DB.prepare(`
      SELECT path, expiry FROM mappings
      WHERE expiry IS NOT NULL AND expiry GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    `).all();
    let migrated = 0;
    for (const row of rows.results) {
      const newExpiry = new Date(row.expiry + 'T00:00:00Z').getTime().toString();
      await DB.prepare(`
        UPDATE mappings SET expiry = ? WHERE path = ?
      `).bind(newExpiry, row.path).run();
      migrated++;
    }
    console.log(`Expiry migration complete: ${migrated} rows`);
  }

  // Step 2: migrate created_at (YYYY-MM-DD HH:MM:SS -> ms timestamp)
  // Note: created_at migration is independent of expiry, because permanent
  // links have a NULL expiry and cannot be detected via the expiry GLOB check.
  const oldCreatedAtCount = await DB.prepare(`
    SELECT COUNT(*) as cnt FROM mappings
    WHERE created_at IS NOT NULL AND created_at LIKE '% %'
  `).first();
  if (oldCreatedAtCount && oldCreatedAtCount.cnt > 0) {
    console.log(`Migrating ${oldCreatedAtCount.cnt} created_at values from date string to timestamp...`);
    const rows = await DB.prepare(`
      SELECT path, created_at FROM mappings
      WHERE created_at IS NOT NULL AND created_at LIKE '% %'
    `).all();
    let migrated = 0;
    for (const row of rows.results) {
      // Skip values already in timestamp format (should not happen, but defensive)
      if (/^\d{13}$/.test(row.created_at)) continue;
      const newCreatedAt = new Date(row.created_at.replace(' ', 'T') + 'Z').getTime().toString();
      await DB.prepare(`
        UPDATE mappings SET created_at = ? WHERE path = ?
      `).bind(newCreatedAt, row.path).run();
      migrated++;
    }
    console.log(`Created_at migration complete: ${migrated} rows`);
  }
}

// Database operation helpers
async function listMappings(page = 1, pageSize = 10, search = '') {
  const offset = (page - 1) * pageSize;
  const hasSearch = typeof search === 'string' && search.trim() !== '';
  const searchTerm = hasSearch ? `%${search.trim()}%` : null;

  // Fetch paginated rows and the total count in a single query
  const results = await DB.prepare(`
    WITH filtered_mappings AS (
      SELECT * FROM mappings 
      WHERE path NOT IN (${banPath.map(() => '?').join(',')})
      ${hasSearch ? 'AND (name LIKE ? OR path LIKE ?)' : ''}
    )
    SELECT 
      filtered.*,
      (SELECT COUNT(*) FROM filtered_mappings) as total_count
    FROM filtered_mappings as filtered
    ORDER BY pinned DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).bind(
    ...banPath,
    ...(hasSearch ? [searchTerm, searchTerm] : []),
    pageSize,
    offset
  ).all();

  if (!results.results || results.results.length === 0) {
    return {
      mappings: {},
      total: 0,
      page,
      pageSize,
      totalPages: 0
    };
  }

  const total = results.results[0].total_count;
  const mappings = {};

  for (const row of results.results) {
    mappings[row.path] = {
      target: row.target,
      name: row.name,
      expiry: row.expiry ? Number(row.expiry) : null,
      enabled: row.enabled === 1,
      isWechat: row.isWechat === 1,
      qrCodeData: row.qrCodeData,
      pinned: row.pinned === 1
    };
  }

  return {
    mappings,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

// Ensure a target URL has an explicit scheme. A bare host like "www.baidu.com"
// has no protocol, which breaks both redirects and stored data. We auto-prepend
// "https://" when no scheme is present.
function normalizeTarget(target) {
  if (!target) return target;
  return /^https?:\/\//i.test(target) ? target : 'https://' + target;
}

// Validate path/target/name/expiry/QR before persisting. `target` is expected
// to already carry a scheme because normalizeTarget() runs upstream in the API
// handler. `qrCodeData` validation only applies to WeChat live-code entries.
function validateMappingInput(path, target, name, expiry, isWechat = false, qrCodeData = null) {
  if (!PATH_RE.test(path)) {
    throw new Error('PATH_INVALID');
  }
  if (path.length > PATH_MAX || (name && name.length > NAME_MAX) || target.length > TARGET_MAX) {
    throw new Error('INPUT_TOO_LONG');
  }
  // Target must be a parseable http(s) URL — reject javascript:, data:, etc.
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    throw new Error('TARGET_INVALID');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('TARGET_INVALID');
  }
  if (expiry && isNaN(Number(expiry))) {
    throw new Error('INVALID_EXPIRY');
  }
  // WeChat live-code image: required and must be an image data URL or http(s) URL
  if (isWechat) {
    if (!qrCodeData) {
      throw new Error('WECHAT_REQUIRES_QR');
    }
    if (!/^data:image\//.test(qrCodeData) && !/^https?:\/\//i.test(qrCodeData)) {
      throw new Error('QR_INVALID');
    }
    if (qrCodeData.length > QR_MAX) {
      throw new Error('QR_TOO_LARGE');
    }
  }
}

async function createMapping(path, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!path || !target || typeof path !== 'string' || typeof target !== 'string') {
    throw new Error('INVALID_INPUT');
  }

  // Reject reserved short-link names
  if (banPath.includes(path)) {
    throw new Error('RESERVED_PATH');
  }

  // Single source of validation (path/target/name/expiry/QR incl. expiry NaN).
  validateMappingInput(path, target, name, expiry, isWechat, qrCodeData);

  await DB.prepare(`
    INSERT INTO mappings (path, target, name, expiry, enabled, isWechat, qrCodeData, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    path,
    target,
    name || null,
    expiry || null,
    enabled ? 1 : 0,
    isWechat ? 1 : 0,
    qrCodeData,
    Date.now().toString()
  ).run();
}

async function deleteMapping(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('INVALID_INPUT');
  }

  // Reject reserved short-link names
  if (banPath.includes(path)) {
    throw new Error('RESERVED_PATH');
  }

  await DB.prepare('DELETE FROM mappings WHERE path = ?').bind(path).run();
}

async function pinMapping(path, pinned) {
  if (!path || typeof path !== 'string') {
    throw new Error('INVALID_INPUT');
  }

  await DB.prepare(`
    UPDATE mappings
    SET pinned = ?
    WHERE path = ?
  `).bind(pinned ? 1 : 0, path).run();
}

async function updateMapping(originalPath, newPath, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!originalPath || !newPath || !target) {
    throw new Error('INVALID_INPUT');
  }

  // Reject reserved short-link names
  if (banPath.includes(newPath)) {
    throw new Error('RESERVED_PATH');
  }

  // Reuse the existing QR data when none is supplied (editing a WeChat code
  // without re-uploading must not wipe its image).
  if (!qrCodeData && isWechat) {
    const existingMapping = await DB.prepare(`
      SELECT qrCodeData
      FROM mappings
      WHERE path = ?
    `).bind(originalPath).first();

    if (existingMapping) {
      qrCodeData = existingMapping.qrCodeData;
    }
  }

  // Single source of validation (path/target/name/expiry/QR incl. expiry NaN
  // and the WeChat-requires-QR rule). Runs after reuse so inherited data passes.
  validateMappingInput(newPath, target, name, expiry, isWechat, qrCodeData);

  const stmt = DB.prepare(`
    UPDATE mappings 
    SET path = ?, target = ?, name = ?, expiry = ?, enabled = ?, isWechat = ?, qrCodeData = ?
    WHERE path = ?
  `);

  await stmt.bind(
    newPath,
    target,
    name || null,
    expiry || null,
    enabled ? 1 : 0,
    isWechat ? 1 : 0,
    qrCodeData,
    originalPath
  ).run();
}

async function getExpiringMappings() {
  // Start of today (local midnight), in ms
  const now = Date.now();
  // Timestamp 3 days from now
  const threeDaysLater = now + 3 * 24 * 60 * 60 * 1000;

  // Fetch all expired and soon-to-expire mappings in one query
  const results = await DB.prepare(`
    WITH categorized_mappings AS (
      SELECT 
        path, name, target, expiry, enabled, isWechat, qrCodeData,
        CASE 
          WHEN CAST(expiry AS INTEGER) < ? THEN 'expired'
          WHEN CAST(expiry AS INTEGER) <= ? THEN 'expiring'
        END as status
      FROM mappings 
      WHERE expiry IS NOT NULL 
        AND CAST(expiry AS INTEGER) <= ? 
        AND enabled = 1
    )
    SELECT * FROM categorized_mappings
    ORDER BY CAST(expiry AS INTEGER) ASC
  `).bind(now, threeDaysLater, threeDaysLater).all();

  const mappings = {
    expiring: [],
    expired: []
  };
  
  for (const row of results.results) {
    const mapping = {
      path: row.path,
      name: row.name,
      target: row.target,
      expiry: row.expiry ? Number(row.expiry) : null,
      enabled: row.enabled === 1,
      isWechat: row.isWechat === 1,
      qrCodeData: row.qrCodeData
    };

    if (row.status === 'expired') {
      mappings.expired.push(mapping);
    } else {
      mappings.expiring.push(mapping);
    }
  }

  return mappings;
}

// Batch-cleanup of expired mappings. Returns the total number deleted.
async function cleanupExpiredMappings(batchSize = 100) {
  const now = Date.now().toString();
  let deleted = 0;

  while (true) {
    // Fetch a batch of expired mappings
    const batch = await DB.prepare(`
      SELECT path 
      FROM mappings 
      WHERE expiry IS NOT NULL 
        AND expiry < ? 
      LIMIT ?
    `).bind(now, batchSize).all();

    if (!batch.results || batch.results.length === 0) {
      break;
    }

    // Delete the batch
    const paths = batch.results.map(row => row.path);
    const placeholders = paths.map(() => '?').join(',');
    await DB.prepare(`
      DELETE FROM mappings 
      WHERE path IN (${placeholders})
    `).bind(...paths).run();

    deleted += batch.results.length;

    // Stop once a full batch is no longer returned
    if (batch.results.length < batchSize) {
      break;
    }
  }

  return deleted;
}

export {
  banPath,
  PATH_MAX,
  NAME_MAX,
  TARGET_MAX,
  QR_MAX,
  PATH_RE,
  normalizeTarget,
  validateMappingInput,
  initDatabase,
  listMappings,
  createMapping,
  deleteMapping,
  pinMapping,
  updateMapping,
  getExpiringMappings,
  cleanupExpiredMappings
};
