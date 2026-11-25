import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('./public/login.js', import.meta.url), 'utf8');
async function signIn(responses, search = '') {
  let submit, destination;
  const requests = [];
  const status = { dataset: {}, setAttribute() {}, focus() {} };
  const button = {};
  const form = { addEventListener(event, listener) { submit = listener; }, querySelector() { return button; } };
  const context = {
    document: { querySelector: () => form, getElementById: id => id === 'status' ? status : { value: 'test-password' } },
    location: { search, replace: path => { destination = path; } }, URLSearchParams, AbortSignal,
    fetch: async (url, options) => { requests.push({ url, options }); return responses.shift(); }
  };
  vm.runInNewContext(script, context);
  if (responses.length) await submit({ preventDefault() {} });
  return { status, button, destination, requests };
}
test('sign-in confirms the cookie-backed session before navigating', async () => {
  const result = await signIn([Response.json({ ok: true }), Response.json({ authenticated: true })]);
  assert.equal(result.destination, '/PT_home/admin/?signedin=1');
  assert.deepEqual(result.requests.map(item => item.url), ['/api/login', '/api/session']);
  assert.ok(result.requests.every(item => item.options.credentials === 'same-origin'));
});
test('a missing session stays on the page with a clear message instead of reloading', async () => {
  const result = await signIn([Response.json({ ok: true }), Response.json({}, { status: 401 })]);
  assert.equal(result.destination, undefined);
  assert.equal(result.button.disabled, false);
  assert.match(result.status.textContent, /password was accepted.*did not keep/);
  assert.equal(result.status.dataset.error, 'true');
});
test('incorrect passwords remain visible and sign-in becomes usable again', async () => {
  const result = await signIn([Response.json({ error: 'Incorrect password.' }, { status: 401 })]);
  assert.equal(result.destination, undefined);
  assert.equal(result.button.disabled, false);
  assert.equal(result.status.textContent, 'Incorrect password.');
});
test('a lost session after navigation is explained on the returned login page', async () => {
  const result = await signIn([], '?signedin=1');
  assert.match(result.status.textContent, /session was not kept/);
});
