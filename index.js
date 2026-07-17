// Worker entry: routing, auth, and API dispatch.
// Backend logic is split into src/* modules (bundled into one Worker by esbuild):
//   - src/state.js  shared runtime state (DB / KV_BINDING) + initState()
//   - src/util.js   escapeHtml()
//   - src/db.js     data layer (schema, CRUD, validation, KV migration)
//   - src/pages.js  public pages (expired / WeChat renderers + i18n)
import { DB, initState } from './src/state.js';
import {
  initDatabase,
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  pinMapping,
  getExpiringMappings,
  normalizeTarget
} from './src/db.js';
import {
  PUBLIC_I18N,
  pickLang,
  renderExpiredPage,
  renderWechatPage
} from './src/pages.js';

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

export default {
  async fetch(request, env) {
    initState(env);

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
            const target = normalizeTarget(data.target);
            await createMapping(data.path, target, data.name, data.expiry, data.enabled, data.isWechat, data.qrCodeData);
            return new Response(JSON.stringify({ success: true, targetNormalized: target !== data.target }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Update a mapping
          if (request.method === 'PUT') {
            const data = await request.json();
            const target = normalizeTarget(data.target);
            await updateMapping(
              data.originalPath,
              data.path,
              target,
              data.name,
              data.expiry,
              data.enabled,
              data.isWechat,
              data.qrCodeData
            );
            return new Response(JSON.stringify({ success: true, targetNormalized: target !== data.target }), {
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
              return new Response(renderExpiredPage({
                name: mapping.name,
                lang,
                T,
                expiry: mapping.expiry
              }), {
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
            return new Response(renderWechatPage({
              name: mapping.name,
              lang,
              T,
              qrCodeData: mapping.qrCodeData
            }), {
              headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'no-store'
              }
            });
          }

          // Non-WeChat links perform a normal redirect.
          // Response.redirect requires an absolute URL; a bare host like
          // "www.baidu.com" has no scheme and would throw "Unable to parse URL".
          // Prepend https:// when no scheme is present.
          const target = /^https?:\/\//i.test(mapping.target)
            ? mapping.target
            : 'https://' + mapping.target;
          return Response.redirect(target, 302);
        }
        return new Response('Not Found', { status: 404 });
      } catch (error) {
        console.error('Redirect error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
  },

  async scheduled(controller, env, ctx) {
    initState(env);

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
