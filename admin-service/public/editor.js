const byId = id => document.getElementById(id);
if (new URLSearchParams(location.search).has('signedin')) history.replaceState(null, '', location.pathname);
const fields = ['title', 'category', 'summary', 'body', 'art', 'image', 'link'];
let cards = [], selected = 0, sha, csrf, dirty = false, busy = false;
const status = message => { byId('status').textContent = message; };
async function api(path, method = 'GET', body) {
  const response = await fetch('/api/' + path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (response.status === 401) { location.reload(); throw new Error('Please sign in again.'); }
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
function controls() {
  byId('publish').disabled = busy || !dirty || !sha;
  byId('add').disabled = busy || !sha || cards.length >= 24;
  byId('reload').disabled = busy;
  byId('logout').disabled = busy;
  for (const field of fields) byId(field).disabled = busy;
  byId('delete').disabled = busy;
  byId('up').disabled = busy || selected === 0;
  byId('down').disabled = busy || selected === cards.length - 1;
  byId('count').textContent = `${cards.length} / 24 cards`;
}
function preview() {
  const card = cards[selected];
  if (!card) return;
  for (const field of ['category', 'title', 'summary']) byId('preview-' + field).textContent = card[field] || (field === 'category' ? 'Studio news' : '');
}
function list() {
  byId('cards').replaceChildren(...cards.map((card, index) => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = card.title || 'Untitled card'; button.disabled = busy;
    button.setAttribute('aria-current', String(index === selected));
    const category = document.createElement('small'); category.textContent = card.category || 'Studio news'; button.append(category);
    button.addEventListener('click', () => { selected = index; render(); });
    return button;
  }));
}
function render() {
  selected = Math.max(0, Math.min(selected, cards.length - 1));
  byId('detail').hidden = !cards.length;
  if (cards[selected]) for (const field of fields) byId(field).value = cards[selected][field] || '';
  list(); preview(); controls();
}
function changed() { dirty = true; status('Unpublished changes.'); controls(); }
async function load() {
  if (dirty && !confirm('Discard your unpublished changes and reload saved news?')) return;
  busy = true; controls(); status('Loading your news…');
  try {
    const data = await api('news');
    cards = data.cards; sha = data.sha; csrf = data.csrf; dirty = false;
    status('All changes are saved.');
  } catch (error) { status(error.message); }
  finally { busy = false; render(); }
}
for (const field of fields) byId(field).addEventListener('input', () => {
  cards[selected][field] = byId(field).value;
  changed(); list(); preview();
});
byId('edit').addEventListener('submit', event => event.preventDefault());
byId('add').addEventListener('click', () => {
  cards.push({ id: crypto.randomUUID(), title: 'New story', category: 'Studio news', summary: '', body: '', art: 'minimal', image: '', link: '' });
  selected = cards.length - 1; changed(); render(); byId('title').focus(); byId('title').select();
});
byId('delete').addEventListener('click', () => {
  if (!confirm(`Delete “${cards[selected].title || 'Untitled card'}”? This takes effect when you publish.`)) return;
  cards.splice(selected, 1); changed(); render();
});
for (const [id, delta] of [['up', -1], ['down', 1]]) byId(id).addEventListener('click', () => {
  const next = selected + delta;
  [cards[selected], cards[next]] = [cards[next], cards[selected]];
  selected = next; changed(); render();
});
byId('publish').addEventListener('click', async () => {
  const invalid = cards.findIndex(card => !card.title.trim() || !card.summary.trim());
  if (invalid !== -1) {
    selected = invalid; render(); byId('edit').reportValidity();
    status('Each card needs a title and short description.'); return;
  }
  busy = true; controls(); list(); status('Publishing your news…');
  try {
    const data = await api('news', 'PUT', { version: 1, cards, sha });
    sha = data.sha; dirty = false;
    status('Published to GitHub. Your website is deploying; reload Home in the launcher after deployment.');
  } catch (error) { status(error.message); }
  finally { busy = false; controls(); list(); }
});
byId('reload').addEventListener('click', load);
byId('logout').addEventListener('click', async () => {
  if (dirty && !confirm('Sign out and discard your unpublished changes?')) return;
  try { await api('logout', 'POST'); dirty = false; location.reload(); } catch (error) { status(error.message); }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
load();
