let KV_BINDING;
let DB;
const banPath = [
  'login', 'admin', '__total_count',
  // static files
  'admin.html', 'login.html',
  'daisyui@5.css', 'tailwindcss@4.js',
  'qr-code-styling.js', 'zxing.js',
  'robots.txt', 'wechat.svg',
  'favicon.svg',
];

// Public (end-user) pages are rendered on the server. The visitor's language is
// detected from the Accept-Language header and falls back to English.
const PUBLIC_LANGS = ['en', 'zh', 'ru', 'ja', 'ko', 'es', 'fr', 'de'];
const PUBLIC_I18N = {
  en: {
    expiredTitle: 'Link Expired',
    expiredHeading: 'has expired',
    expiredOn: 'Expired on',
    expiredFooter: 'Contact the admin to update this link',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Long-press to recognize the QR code below',
    wechatFooter: 'If the QR code expires, contact the author to update it'
  },
  zh: {
    expiredTitle: '链接已过期',
    expiredHeading: '已过期',
    expiredOn: '过期时间',
    expiredFooter: '如需访问，请联系管理员更新链接',
    wechatTitle: '微信群二维码',
    wechatHeading: '微信群二维码',
    wechatNotice: '请长按识别下方二维码',
    wechatFooter: '二维码失效请联系作者更新'
  },
  ru: {
    expiredTitle: 'Ссылка устарела',
    expiredHeading: 'устарела',
    expiredOn: 'Дата окончания',
    expiredFooter: 'Для доступа обратитесь к администратору',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Нажмите и удерживайте, чтобы распознать QR-код ниже',
    wechatFooter: 'Если QR-код устарел, обратитесь к автору для обновления'
  },
  ja: {
    expiredTitle: 'リンクは期限切れです',
    expiredHeading: 'は期限切れです',
    expiredOn: '有効期限',
    expiredFooter: 'アクセスするには管理者にリンクの更新を依頼してください',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: '下のQRコードを長押しして認識してください',
    wechatFooter: 'QRコードが無効な場合は作者に更新を依頼してください'
  },
  ko: {
    expiredTitle: '링크가 만료되었습니다',
    expiredHeading: '만료되었습니다',
    expiredOn: '만료 날짜',
    expiredFooter: '접속하려면 관리자에게 링크 업데이트를 요청하세요',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: '아래 QR 코드를 길게 눌러 인식하세요',
    wechatFooter: 'QR 코드가 만료되면 작성자에게 업데이트를 요청하세요'
  },
  es: {
    expiredTitle: 'Enlace caducado',
    expiredHeading: 'ha caducado',
    expiredOn: 'Caducó el',
    expiredFooter: 'Para acceder, contacte al administrador para actualizar el enlace',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Mantenga pulsado para reconocer el código QR de abajo',
    wechatFooter: 'Si el código QR caduca, contacte al autor para actualizarlo'
  },
  fr: {
    expiredTitle: 'Lien expiré',
    expiredHeading: 'a expiré',
    expiredOn: 'Expiré le',
    expiredFooter: 'Pour y accéder, contactez l\'administrateur pour mettre à jour le lien',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Appuyez longuement pour reconnaître le QR code ci-dessous',
    wechatFooter: 'Si le QR code expire, contactez l\'auteur pour le mettre à jour'
  },
  de: {
    expiredTitle: 'Link abgelaufen',
    expiredHeading: 'ist abgelaufen',
    expiredOn: 'Abgelaufen am',
    expiredFooter: 'Wenden Sie sich an den Administrator, um den Link zu aktualisieren',
    wechatTitle: 'WeChat QR',
    wechatHeading: 'WeChat QR',
    wechatNotice: 'Halten Sie zum Erkennen des QR-Codes unten lang',
    wechatFooter: 'Wenn der QR-Code abläuft, wenden Sie sich an den Autor zur Aktualisierung'
  }
};

// Escape HTML in user-provided content before inserting it into generated pages.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Pick the public-page language from the Accept-Language header.
function pickLang(request) {
  const header = request.headers.get('Accept-Language') || '';
  const parts = header.split(',');
  for (const part of parts) {
    const code = part.split(';')[0].trim().split('-')[0].toLowerCase();
    if (PUBLIC_LANGS.indexOf(code) !== -1) return code;
  }
  return 'en';
}

// Database initialization
async function initDatabase() {
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

// Cookie-related helpers
function verifyAuthCookie(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const authToken = cookie.split(';').find(c => c.trim().startsWith('token='));
  if (!authToken) return false;
  return authToken.split('=')[1].trim() === env.PASSWORD;
}

function setAuthCookie(password) {
  return {
    'Set-Cookie': `token=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
    'Content-Type': 'application/json'
  };
}

function clearAuthCookie() {
  return {
    'Set-Cookie': 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
    'Content-Type': 'application/json'
  };
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

async function createMapping(path, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!path || !target || typeof path !== 'string' || typeof target !== 'string') {
    throw new Error('INVALID_INPUT');
  }

  // Reject reserved short-link names
  if (banPath.includes(path)) {
    throw new Error('RESERVED_PATH');
  }

  if (expiry && isNaN(Number(expiry))) {
    throw new Error('INVALID_EXPIRY');
  }

  // WeChat QR codes require the original QR image data
  if (isWechat && !qrCodeData) {
    throw new Error('WECHAT_REQUIRES_QR');
  }

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

  if (expiry && isNaN(Number(expiry))) {
    throw new Error('INVALID_EXPIRY');
  }

  // Reuse the existing QR data when none is supplied
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

  // WeChat QR codes must have QR image data
  if (isWechat && !qrCodeData) {
    throw new Error('WECHAT_REQUIRES_QR');
  }

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

// Batch-cleanup of expired mappings
async function cleanupExpiredMappings(batchSize = 100) {
  const now = Date.now().toString();
  
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

    // Stop once a full batch is no longer returned
    if (batch.results.length < batchSize) {
      break;
    }
  }
}

// Data migration from KV
async function migrateFromKV() {
  let cursor = null;
  do {
    const listResult = await KV_BINDING.list({ cursor, limit: 1000 });
    
    for (const key of listResult.keys) {
      if (!banPath.includes(key.name)) {
        const value = await KV_BINDING.get(key.name, { type: "json" });
        if (value) {
          try {
            await createMapping(
              key.name,
              value.target,
              value.name,
              value.expiry,
              value.enabled,
              value.isWechat,
              value.qrCodeData
            );
          } catch (e) {
            console.error(`Failed to migrate ${key.name}:`, e);
          }
        }
      }
    }
    
    cursor = listResult.cursor;
  } while (cursor);
}

export default {
  async fetch(request, env) {
    KV_BINDING = env.KV_BINDING;
    DB = env.DB;
    
    // Initialize the database
    await initDatabase();
    
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Root path redirects to the admin dashboard
    if (path === '') {
      return Response.redirect(url.origin + '/admin.html', 302);
    }

    // API route handling
    if (path.startsWith('api/')) {
      // Login API
      if (path === 'api/login' && request.method === 'POST') {
        const { password } = await request.json();
        if (password === env.PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: setAuthCookie(password)
          });
        }
        return new Response('Unauthorized', { status: 401 });
      }

      // Logout API
      if (path === 'api/logout' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), {
          headers: clearAuthCookie()
        });
      }

      // APIs that require authentication
      if (!verifyAuthCookie(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }

      try {
        // Expiring / expired mappings
        if (path === 'api/expiring-mappings') {
          const result = await getExpiringMappings();
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // List mappings
        if (path === 'api/mappings') {
          const params = new URLSearchParams(url.search);
          const page = parseInt(params.get('page')) || 1;
          const pageSize = parseInt(params.get('pageSize')) || 10;
          const search = (params.get('search') || '').slice(0, 64);

          const result = await listMappings(page, pageSize, search);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Mapping management API
        if (path === 'api/mapping') {
          // Get a single mapping
          if (request.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const mappingPath = params.get('path');
            if (!mappingPath) {
              return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }

            const mapping = await DB.prepare(`
              SELECT path, target, name, expiry, enabled, isWechat, qrCodeData
              FROM mappings
              WHERE path = ?
            `).bind(mappingPath).first();
            if (!mapping) {
              return new Response(JSON.stringify({ error: 'Mapping not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
              });
            }

            return new Response(JSON.stringify(mapping), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Create a mapping
          if (request.method === 'POST') {
            const data = await request.json();
            await createMapping(data.path, data.target, data.name, data.expiry, data.enabled, data.isWechat, data.qrCodeData);
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Update a mapping
          if (request.method === 'PUT') {
            const data = await request.json();
            await updateMapping(
              data.originalPath,
              data.path,
              data.target,
              data.name,
              data.expiry,
              data.enabled,
              data.isWechat,
              data.qrCodeData
            );
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Delete a mapping
          if (request.method === 'DELETE') {
            const { path } = await request.json();
            await deleteMapping(path);
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Pin / unpin a mapping
        if (path === 'api/mapping/pin') {
          if (request.method === 'POST') {
            const { path: pinnedPath, pinned } = await request.json();
            if (!pinnedPath) {
              return new Response(JSON.stringify({ error: 'Missing path' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            await pinMapping(pinnedPath, pinned);
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        return new Response('Not Found', { status: 404 });
      } catch (error) {
        console.error('API operation error:', error);
        return new Response(JSON.stringify({
          error: error.message || 'Internal Server Error'
        }), {
          status: error.message === 'INVALID_INPUT' ? 400 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // URL redirection handling
    if (path) {
      try {
        const lang = pickLang(request);
        const T = PUBLIC_I18N[lang];
        const mapping = await DB.prepare(`
          SELECT path, target, name, expiry, enabled, isWechat, qrCodeData
          FROM mappings
          WHERE path = ?
        `).bind(path).first();
        if (mapping) {
          // Check whether the link is enabled
          if (!mapping.enabled) {
            return new Response('Not Found', { status: 404 });
          }

          // Check whether the link is expired
          if (mapping.expiry) {
            if (Number(mapping.expiry) < Date.now()) {
              const expiredHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${T.expiredTitle}</title>
    <style>
        :root {
            color-scheme: light dark;
            --brand: #2563EB;
            --bg: #f1f5f9;
            --card: #ffffff;
            --title: #0f172a;
            --text: #475569;
            --muted: #94a3b8;
            --border: #e2e8f0;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --card: #1e293b;
                --title: #e2e8f0;
                --text: #94a3b8;
                --muted: #64748b;
                --border: #334155;
            }
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: var(--bg);
            -webkit-font-smoothing: antialiased;
        }
        .card {
            width: 100%;
            max-width: 360px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 36px 24px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 20px 40px -24px rgba(15,23,42,.25);
        }
        .icon {
            width: 56px; height: 56px;
            margin: 0 auto 18px;
            border-radius: 14px;
            display: grid; place-items: center;
            background: color-mix(in oklab, var(--brand) 12%, transparent);
            color: var(--brand);
        }
        .icon svg { width: 28px; height: 28px; }
        .title { font-size: 20px; font-weight: 700; color: var(--title); margin: 0 0 10px; }
        .message { font-size: 14px; color: var(--text); margin: 8px 0; line-height: 1.6; }
        .footer { font-size: 13px; color: var(--muted); margin-top: 22px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <h1 class="title">${mapping.name ? escapeHtml(mapping.name) + ' ' + T.expiredHeading : T.expiredTitle}</h1>
        <p class="message">${T.expiredOn}: ${new Date(Number(mapping.expiry)).toLocaleDateString()}</p>
        <p class="footer">${T.expiredFooter}</p>
    </div>
</body>
</html>`;
              return new Response(expiredHtml, {
                status: 404,
                headers: {
                  'Content-Type': 'text/html;charset=UTF-8',
                  'Cache-Control': 'no-store'
                }
              });
            }
          }

          // WeChat QR codes return the live-code page
          if (mapping.isWechat === 1 && mapping.qrCodeData) {
            const wechatHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mapping.name ? escapeHtml(mapping.name) : T.wechatTitle}</title>
    <style>
        :root {
            color-scheme: light dark;
            --brand: #2563EB;
            --bg: #f1f5f9;
            --card: #ffffff;
            --title: #0f172a;
            --text: #475569;
            --muted: #94a3b8;
            --border: #e2e8f0;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #0f172a;
                --card: #1e293b;
                --title: #e2e8f0;
                --text: #94a3b8;
                --muted: #64748b;
                --border: #334155;
            }
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
            background: var(--bg);
            -webkit-font-smoothing: antialiased;
        }
        .card {
            width: 100%;
            max-width: 360px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 20px 40px -24px rgba(15,23,42,.25);
        }
        .icon {
            width: 52px; height: 52px;
            margin: 0 auto 14px;
            border-radius: 14px;
            display: grid; place-items: center;
            background: color-mix(in oklab, var(--brand) 12%, transparent);
        }
        .icon img { width: 30px; height: 30px; }
        .title { font-size: 20px; font-weight: 700; color: var(--title); margin: 0 0 8px; }
        .notice { font-size: 15px; color: var(--text); margin: 14px 0 0; line-height: 1.6; }
        .qr-wrap {
            margin: 20px auto;
            padding: 14px;
            background: #ffffff;
            border-radius: 12px;
            width: fit-content;
            box-shadow: 0 4px 12px -6px rgba(15,23,42,.2);
        }
        .qr-code { width: 240px; height: 240px; display: block; border-radius: 6px; }
        .footer { font-size: 13px; color: var(--muted); margin-top: 18px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon"><img src="wechat.svg" alt="WeChat"></div>
        <h1 class="title">${mapping.name ? escapeHtml(mapping.name) : T.wechatHeading}</h1>
        <p class="notice">${T.wechatNotice}</p>
        <div class="qr-wrap"><img class="qr-code" src="${mapping.qrCodeData}" alt="WeChat QR"></div>
        <p class="footer">${T.wechatFooter}</p>
    </div>
</body>
</html>`;
            return new Response(wechatHtml, {
              headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'no-store'
              }
            });
          }

          // Non-WeChat links perform a normal redirect
          return Response.redirect(mapping.target, 302);
        }
        return new Response('Not Found', { status: 404 });
      } catch (error) {
        console.error('Redirect error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
  },

  async scheduled(controller, env, ctx) {
    KV_BINDING = env.KV_BINDING;
    DB = env.DB;
    
    // Initialize the database
    await initDatabase();
        
    // Build the expired / expiring report
    const result = await getExpiringMappings();

    console.log(`Cron job report: Found ${result.expired.length} expired mappings`);
    if (result.expired.length > 0) {
      console.log('Expired mappings:', JSON.stringify(result.expired, null, 2));
    }

    console.log(`Found ${result.expiring.length} mappings expiring in 2 days`);
    if (result.expiring.length > 0) {
      console.log('Expiring soon mappings:', JSON.stringify(result.expiring, null, 2));
    }
  },

};