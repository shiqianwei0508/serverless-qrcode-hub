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

// 数据库初始化
async function initDatabase() {
  // 创建表
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

  // 检查是否需要添加新列
  const tableInfo = await DB.prepare("PRAGMA table_info(mappings)").all();
  const columns = tableInfo.results.map(col => col.name);

  // 添加 isWechat 列（如果不存在）
  if (!columns.includes('isWechat')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN isWechat INTEGER DEFAULT 0
    `).run();
  }

  // 添加 qrCodeData 列（如果不存在）
  if (!columns.includes('qrCodeData')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN qrCodeData TEXT
    `).run();
  }

  // 添加 pinned 列（如果不存在），用于条目全局置顶
  if (!columns.includes('pinned')) {
    await DB.prepare(`
      ALTER TABLE mappings 
      ADD COLUMN pinned INTEGER DEFAULT 0
    `).run();
  }

  // 添加索引
  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_expiry ON mappings(expiry)
  `).run();

  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON mappings(created_at)
  `).run();

  // 组合索引：用于启用状态和过期时间的组合查询
  await DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_enabled_expiry ON mappings(enabled, expiry)
  `).run();

  // 数据迁移：将旧格式日期字符串转为毫秒时间戳
  // Step 1: 迁移 expiry 字段（YYYY-MM-DD → 毫秒时间戳）
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

  // Step 2: 迁移 created_at 字段（YYYY-MM-DD HH:MM:SS → 毫秒时间戳）
  // 注意：created_at 的迁移独立于 expiry，因为永久链接的 expiry 为 NULL，
  // 不能依赖 expiry 的 GLOB 检测来触发 created_at 迁移
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
      // 跳过已经是时间戳格式的（不应该出现，但做防御）
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

// Cookie 相关函数
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

// 数据库操作相关函数
async function listMappings(page = 1, pageSize = 10, search = '') {
  const offset = (page - 1) * pageSize;
  const hasSearch = typeof search === 'string' && search.trim() !== '';
  const searchTerm = hasSearch ? `%${search.trim()}%` : null;

  // 使用单个查询获取分页数据和总数
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
    throw new Error('Invalid input');
  }

  // 检查短链名是否在禁用列表中
  if (banPath.includes(path)) {
    throw new Error('该短链名已被系统保留，请使用其他名称');
  }

  if (expiry && isNaN(Number(expiry))) {
    throw new Error('Invalid expiry date');
  }

  // 如果是微信二维码，必须提供二维码数据
  if (isWechat && !qrCodeData) {
    throw new Error('微信二维码必须提供原始二维码数据');
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
    throw new Error('Invalid input');
  }

  // 检查是否在禁用列表中
  if (banPath.includes(path)) {
    throw new Error('系统保留的短链名无法删除');
  }

  await DB.prepare('DELETE FROM mappings WHERE path = ?').bind(path).run();
}

async function pinMapping(path, pinned) {
  if (!path || typeof path !== 'string') {
    throw new Error('Invalid input');
  }

  await DB.prepare(`
    UPDATE mappings
    SET pinned = ?
    WHERE path = ?
  `).bind(pinned ? 1 : 0, path).run();
}

async function updateMapping(originalPath, newPath, target, name, expiry, enabled = true, isWechat = false, qrCodeData = null) {
  if (!originalPath || !newPath || !target) {
    throw new Error('Invalid input');
  }

  // 检查新短链名是否在禁用列表中
  if (banPath.includes(newPath)) {
    throw new Error('该短链名已被系统保留，请使用其他名称');
  }

  if (expiry && isNaN(Number(expiry))) {
    throw new Error('Invalid expiry date');
  }

  // 如果没有提供新的二维码数据，获取原有的二维码数据
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

  // 如果是微信二维码，必须有二维码数据
  if (isWechat && !qrCodeData) {
    throw new Error('微信二维码必须提供原始二维码数据');
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
  // 今天本地 0 点的时间戳（毫秒）
  const now = Date.now();
  // 3天后的时间戳
  const threeDaysLater = now + 3 * 24 * 60 * 60 * 1000;

  // 使用单个查询获取所有过期和即将过期的映射
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

// 添加新的批量清理过期映射的函数
async function cleanupExpiredMappings(batchSize = 100) {
  const now = Date.now().toString();
  
  while (true) {
    // 获取一批过期的映射
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

    // 批量删除这些映射
    const paths = batch.results.map(row => row.path);
    const placeholders = paths.map(() => '?').join(',');
    await DB.prepare(`
      DELETE FROM mappings 
      WHERE path IN (${placeholders})
    `).bind(...paths).run();

    // 如果获取的数量小于 batchSize，说明已经处理完所有过期映射
    if (batch.results.length < batchSize) {
      break;
    }
  }
}

// 数据迁移函数
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
    
    // 初始化数据库
    await initDatabase();
    
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // 根目录跳转到 管理后台
    if (path === '') {
      return Response.redirect(url.origin + '/admin.html', 302);
    }

    // API 路由处理
    if (path.startsWith('api/')) {
      // 登录 API
      if (path === 'api/login' && request.method === 'POST') {
        const { password } = await request.json();
        if (password === env.PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: setAuthCookie(password)
          });
        }
        return new Response('Unauthorized', { status: 401 });
      }

      // 登出 API
      if (path === 'api/logout' && request.method === 'POST') {
        return new Response(JSON.stringify({ success: true }), {
          headers: clearAuthCookie()
        });
      }

      // 需要认证的 API
      if (!verifyAuthCookie(request, env)) {
        return new Response('Unauthorized', { status: 401 });
      }

      try {
        // 获取即将过期和已过期的映射
        if (path === 'api/expiring-mappings') {
          const result = await getExpiringMappings();
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取映射列表
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

        // 映射管理 API
        if (path === 'api/mapping') {
          // 获取单个映射
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

          // 创建映射
          if (request.method === 'POST') {
            const data = await request.json();
            await createMapping(data.path, data.target, data.name, data.expiry, data.enabled, data.isWechat, data.qrCodeData);
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // 更新映射
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

          // 删除映射
          if (request.method === 'DELETE') {
            const { path } = await request.json();
            await deleteMapping(path);
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // 置顶 / 取消置顶映射
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
          status: error.message === 'Invalid input' ? 400 : 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // URL 重定向处理
    if (path) {
      try {
        const mapping = await DB.prepare(`
          SELECT path, target, name, expiry, enabled, isWechat, qrCodeData
          FROM mappings
          WHERE path = ?
        `).bind(path).first();
        if (mapping) {
          // 检查是否启用
          if (!mapping.enabled) {
            return new Response('Not Found', { status: 404 });
          }

          // 检查是否过期
          if (mapping.expiry) {
            if (Number(mapping.expiry) < Date.now()) {
              const expiredHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>链接已过期</title>
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
        <h1 class="title">${mapping.name ? mapping.name + ' 已过期' : '链接已过期'}</h1>
        <p class="message">过期时间：${new Date(Number(mapping.expiry)).toLocaleDateString()}</p>
        <p class="footer">如需访问，请联系管理员更新链接</p>
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

          // 如果是微信二维码，返回活码页面
          if (mapping.isWechat === 1 && mapping.qrCodeData) {
            const wechatHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${mapping.name || '微信群二维码'}</title>
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
        <h1 class="title">${mapping.name ? mapping.name : '微信二维码'}</h1>
        <p class="notice">请长按识别下方二维码</p>
        <div class="qr-wrap"><img class="qr-code" src="${mapping.qrCodeData}" alt="微信群二维码"></div>
        <p class="footer">二维码失效请联系作者更新</p>
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

          // 如果不是微信二维码，执行普通重定向
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
    
    // 初始化数据库
    await initDatabase();
        
    // 获取过期和即将过期的映射报告
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