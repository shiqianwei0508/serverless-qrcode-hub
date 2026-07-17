// Escape HTML in user-provided content before inserting it into generated pages.
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Auth cookie: a signed token `issuedAt.<hmac>` instead of the raw admin
// password. The HMAC key is the admin password itself (no extra secret to
// configure). Workers runtime provides crypto.subtle + btoa globally.
const COOKIE_NAME = 'auth';
const COOKIE_MAX_AGE = 86400; // 1 day, in seconds

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return toBase64Url(new Uint8Array(sig));
}

// Constant-time string comparison to avoid timing leaks on the signature.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Build a signed auth token for the given secret.
export async function makeAuthToken(secret) {
  const issuedAt = Date.now().toString();
  const sig = await hmacSign(issuedAt, secret);
  return `${issuedAt}.${sig}`;
}

// Validate a signed auth token: correct signature AND still within Max-Age.
export async function verifyAuthToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [issuedAt, sig] = parts;
  const issuedAtNum = Number(issuedAt);
  if (!Number.isFinite(issuedAtNum)) return false;
  if (Date.now() - issuedAtNum > COOKIE_MAX_AGE * 1000) return false;
  const expected = await hmacSign(issuedAt, secret);
  return safeEqual(expected, sig);
}

// Build the Set-Cookie header value for a freshly issued auth token.
export async function authCookieHeader(secret) {
  const token = await makeAuthToken(secret);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}`;
}

// Build the Set-Cookie header value that clears the auth cookie (logout).
export function clearAuthCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
