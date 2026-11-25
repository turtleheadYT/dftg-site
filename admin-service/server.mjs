import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ADMIN = '/PT_home/admin/';
const COOKIE = '__Host-pt-admin';
const arts = new Set(['tesseract', 'studio', 'community', 'minimal']);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function validateNews(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.cards) || data.cards.length > 24)
    throw fail(400, 'Use up to 24 news cards.');
  const ids = new Set();
  const cards = data.cards.map(card => {
    if (!card || typeof card !== 'object') throw fail(400, 'Invalid card.');
    const result = {};
    for (const [key, max] of Object.entries({ id: 100, title: 160, category: 80, summary: 600, body: 20000, art: 20, image: 2000, link: 2000 })) {
      if (typeof (card[key] ?? '') !== 'string' || (card[key] || '').length > max)
        throw fail(400, `Invalid ${key}; maximum ${max} characters.`);
      result[key] = (card[key] || '').trim();
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(result.id) || ids.has(result.id)) throw fail(400, 'Card IDs must be unique.');
    ids.add(result.id);
    if (!result.title || !result.summary || !arts.has(result.art)) throw fail(400, 'Each card needs a title, summary, and artwork style.');
    for (const key of ['image', 'link']) {
      if (!result[key]) continue;
      let url;
      try { url = new URL(result[key], 'https://dftg.site/PT_home/'); } catch { throw fail(400, `Invalid ${key} URL.`); }
      const protocols = key === 'link' ? ['https:', 'mailto:'] : ['https:'];
      if (!protocols.includes(url.protocol) || url.username || url.password) throw fail(400, `Invalid ${key} URL.`);
    }
    return result;
  });
  return { version: 1, cards };
}

export function createServer(config, fetchImpl = fetch) {
  const { password, secret, token, origin } = config;
  if (!password || password.length < 16 || !secret || secret.length < 32 || !token)
    throw new Error('Set ADMIN_PASSWORD (at least 16 characters), SESSION_SECRET (at least 32 characters), and GITHUB_TOKEN.');
  if (!origin || new URL(origin).origin !== origin || (!origin.startsWith('https://') && !config.local))
    throw new Error('Set ADMIN_ORIGIN to the exact HTTPS service origin, without a trailing slash.');
  const salt = randomBytes(32);
  const passwordHash = scryptSync(password, salt, 32);
  const sessions = new Map();
  let attempts = 0;
  let windowEnd = 0;
  const secure = !config.local;
  const cookieName = secure ? COOKIE : 'pt-admin-local';
  const cookie = value => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? 28800 : 0}${secure ? '; Secure' : ''}`;
  const sign = value => createHmac('sha256', secret).update(value).digest('hex');
  const matches = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  function session(req) {
    const value = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!value) return null;
    const [id, signature] = value.split('.');
    if (!id || !matches(signature, sign(id))) return null;
    const found = sessions.get(id);
    if (!found || found.expires < Date.now()) { sessions.delete(id); return null; }
    return { ...found, id };
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw fail(415, 'Send JSON.');
    let raw = '';
    for await (const part of req) {
      raw += part;
      if (Buffer.byteLength(raw) > 600000) throw fail(413, 'News is too large.');
    }
    try { return JSON.parse(raw); } catch { throw fail(400, 'Invalid request.'); }
  }
  async function github(method, data) {
    const response = await fetchImpl('https://api.github.com/repos/turtleheadYT/dftg-site/contents/PT_home/news.json' + (method === 'GET' ? '?ref=main' : ''), {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'probably-turtle-admin', ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw fail(response.status === 409 || response.status === 422 ? 409 : 502,
      response.status === 409 || response.status === 422 ? 'News changed elsewhere. Reload before publishing.' : 'GitHub could not save or load news. Check the service token and repository access.');
    return response.json();
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, origin).pathname;
      if (req.method === 'GET' && path === '/health') return send(200, { ok: true });
      if (req.method === 'GET' && (path === '/' || path === '/PT_home/admin')) {
        res.writeHead(302, { Location: ADMIN }); return res.end();
      }
      // Reject cross-site writes, including login CSRF. No cross-origin API is enabled.
      if (req.method !== 'GET' && req.headers.origin !== origin) throw fail(403, 'Request origin rejected.');
      if (req.method === 'POST' && path === '/api/login') {
        if (Date.now() > windowEnd) { attempts = 0; windowEnd = Date.now() + 600000; }
        if (attempts >= 10) { res.setHeader('Retry-After', Math.ceil((windowEnd - Date.now()) / 1000)); throw fail(429, 'Too many sign-in attempts. Try again in 10 minutes.'); }
        attempts++;
        const input = await body(req);
        const candidate = typeof input.password === 'string' && input.password.length <= 1024 ? input.password : '';
        if (!timingSafeEqual(scryptSync(candidate, salt, 32), passwordHash)) throw fail(401, 'Incorrect password.');
        for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
        if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
        const id = randomBytes(32).toString('hex');
        sessions.set(id, { csrf: randomBytes(32).toString('hex'), expires: Date.now() + 28800000 });
        res.setHeader('Set-Cookie', cookie(`${id}.${sign(id)}`)); return send(200, { ok: true });
      }
      const user = session(req);
      if (path.startsWith('/api/')) {
        if (!user) throw fail(401, 'Please sign in again.');
        if (req.method !== 'GET' && !matches(req.headers['x-csrf-token'], user.csrf)) throw fail(403, 'Session check failed. Refresh and try again.');
        if (req.method === 'GET' && path === '/api/news') {
          const file = await github('GET');
          return send(200, { ...validateNews(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))), sha: file.sha, csrf: user.csrf });
        }
        if (req.method === 'PUT' && path === '/api/news') {
          const input = await body(req);
          const news = validateNews(input);
          if (!/^[a-f0-9]{40,64}$/.test(input.sha || '')) throw fail(400, 'Reload news before publishing.');
          const saved = await github('PUT', { message: 'Update studio news from private admin', branch: 'main', sha: input.sha, content: Buffer.from(JSON.stringify(news, null, 2) + '\n').toString('base64') });
          return send(200, { sha: saved.content.sha });
        }
        if (req.method === 'POST' && path === '/api/logout') {
          sessions.delete(user.id); res.setHeader('Set-Cookie', cookie('')); return send(200, { ok: true });
        }
        throw fail(404, 'Not found.');
      }
      if (req.method === 'GET') {
        let file;
        if (path === ADMIN) file = user ? 'editor.html' : 'login.html';
        else if (path === ADMIN + 'login.js') file = 'login.js';
        else if (path === ADMIN + 'style.css') file = 'style.css';
        else if (path === ADMIN + 'editor.js' && user) file = 'editor.js';
        if (file) {
          const content = await readFile(new URL('./public/' + file, import.meta.url));
          res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' });
          return res.end(content);
        }
      }
      throw fail(404, 'Not found.');
    } catch (error) { send(error.status || 500, { error: error.status ? error.message : 'The server could not complete this request.' }); }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createServer({ password: process.env.ADMIN_PASSWORD, secret: process.env.SESSION_SECRET, token: process.env.GITHUB_TOKEN, origin: process.env.ADMIN_ORIGIN || process.env.RENDER_EXTERNAL_URL });
  server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => console.log('Private news admin is listening.'));
}
