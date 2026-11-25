import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, validateNews } from './server.mjs';

const card = { id: 'hello', title: 'Hello', summary: 'Studio news', category: 'News', body: 'An article.', art: 'tesseract' };
const news = { version: 1, cards: [card] };
const sha = 'a'.repeat(40);

test('validation rejects unsafe URLs, duplicate IDs, missing fields and oversized news', () => {
  assert.equal(validateNews(news).cards[0].title, 'Hello');
  for (const cards of [[{ ...card, link: 'javascript:alert(1)' }], [{ ...card, image: 'data:image/png,x' }], [card, card], [{ ...card, title: '' }], Array(25).fill(card)])
    assert.throws(() => validateNews({ version: 1, cards }), { status: 400 });
});

test('missing production secrets prevent startup', () => {
  assert.throws(() => createServer({}), /Set ADMIN_PASSWORD/);
});

test('private editor: authentication, CSRF, publish, conflicts and logout', async t => {
  let writes = [];
  let conflict = false;
  const mockGitHub = async (url, options) => {
    assert.ok(url.startsWith('https://api.github.com/repos/turtleheadYT/dftg-site/contents/PT_home/news.json'));
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (options.method === 'GET') return Response.json({ sha, content: Buffer.from(JSON.stringify(news)).toString('base64') });
    if (conflict) return Response.json({}, { status: 409 });
    writes.push(JSON.parse(options.body));
    return Response.json({ content: { sha: 'b'.repeat(40) } });
  };
  const server = createServer({ password: 'test-password-long-enough', secret: 's'.repeat(32), token: 'test-token', origin: 'https://admin.example', local: true }, mockGitHub);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie;
  async function request(path, method = 'GET', data, csrf, origin = 'https://admin.example') {
    return fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  }
  assert.equal((await request('/api/news')).status, 401);
  assert.equal((await request('/api/session')).status, 401);
  const loginPage = await request('/PT_home/admin/');
  assert.match(await loginPage.text(), /Admin password/);
  assert.equal(loginPage.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/PT_home/admin/editor.js')).status, 404);
  assert.equal((await request('/api/login', 'POST', { password: 'test-password-long-enough' }, null, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/login', 'POST', { password: 'wrong' })).status, 401);
  const login = await request('/api/login', 'POST', { password: 'test-password-long-enough' });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.deepEqual(await (await request('/api/session')).json(), { authenticated: true });
  assert.match(await (await request('/PT_home/admin/')).text(), /Publish changes/);
  const loaded = await (await request('/api/news')).json();
  assert.equal(loaded.cards[0].title, 'Hello');
  assert.equal(loaded.sha, sha);
  assert.equal((await request('/api/news', 'PUT', { ...news, sha })).status, 403);
  assert.equal((await request('/api/news', 'PUT', { ...news, sha }, loaded.csrf, 'https://evil.example')).status, 403);
  assert.equal((await request('/api/news', 'PUT', { version: 1, cards: [{ ...card, link: 'javascript:x' }], sha }, loaded.csrf)).status, 400);
  const saved = await request('/api/news', 'PUT', { ...news, sha }, loaded.csrf);
  assert.equal(saved.status, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].sha, sha);
  assert.equal(writes[0].branch, 'main');
  assert.equal(JSON.parse(Buffer.from(writes[0].content, 'base64').toString()).cards[0].title, 'Hello');
  conflict = true;
  assert.equal((await request('/api/news', 'PUT', { ...news, sha }, loaded.csrf)).status, 409);
  assert.equal((await request('/api/logout', 'POST', {}, loaded.csrf)).status, 200);
  assert.equal((await request('/api/session')).status, 401);
  assert.equal((await request('/api/news')).status, 401);
});

test('production sessions use secure host cookies; repeated bad logins are limited', async t => {
  const server = createServer({ password: 'test-password-long-enough', secret: 's'.repeat(32), token: 'test-token', origin: 'https://admin.example' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const login = password => fetch('http://127.0.0.1:' + server.address().port + '/api/login', { method: 'POST', headers: { Origin: 'https://admin.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  const response = await login('test-password-long-enough');
  assert.match(response.headers.get('set-cookie'), /^__Host-pt-admin=.*; Secure$/);
  for (let index = 0; index < 9; index++) assert.equal((await login('bad')).status, 401);
  assert.equal((await login('bad')).status, 429);
});
