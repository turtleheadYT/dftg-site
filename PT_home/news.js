(() => {
  'use strict';
  const grid = document.getElementById('news-grid');
  const status = document.getElementById('news-status');
  const retry = document.getElementById('retry-news');
  const article = document.getElementById('news-article');
  const close = document.getElementById('close-article');
  const artStyles = new Set(['tesseract', 'studio', 'community', 'minimal']);
  let lastTrigger;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeLink(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      return ['https:', 'mailto:'].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  function openArticle(card, trigger) {
    document.getElementById('article-category').textContent = card.category || 'Studio news';
    document.getElementById('article-title').textContent = card.title;
    document.getElementById('article-body').textContent = card.body || card.summary;
    const link = document.getElementById('article-link');
    const href = safeLink(card.link);
    link.hidden = !href;
    if (href) {
      link.href = href;
      link.textContent = href.startsWith('mailto:') ? 'Contact the studio' : 'Learn more';
    } else { link.removeAttribute('href'); }
    lastTrigger = trigger;
    article.showModal();
    close.focus();
  }

  function renderCard(card, index) {
    const container = element('article', 'news-card');
    const trigger = element('a', 'card-link');
    trigger.href = '#news-' + encodeURIComponent(card.id || String(index));
    const art = element('span', 'card-art art-' + (artStyles.has(card.art) ? card.art : 'minimal'));
    art.setAttribute('aria-hidden', 'true');
    // Optional local/HTTPS artwork stays monochrome to match the Bulletin design.
    const imageUrl = safeLink(card.image);
    if (imageUrl && imageUrl.startsWith('https:')) {
      const image = element('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), { once: true });
      art.appendChild(image);
    }
    const copy = element('div', 'card-copy');
    copy.append(element('span', 'card-category', card.category || 'Studio news'),
      element('h3', '', card.title), element('p', 'card-summary', card.summary));
    const bottom = element('span', 'card-bottom');
    const icon = element('span', 'story-icon');
    icon.setAttribute('aria-hidden', 'true');
    bottom.append(icon, element('span', '', 'Read the story'));
    copy.appendChild(bottom);
    trigger.append(art, copy);
    trigger.addEventListener('click', event => {
      event.preventDefault();
      openArticle(card, trigger);
    });
    container.appendChild(trigger);
    return container;
  }

  async function loadNews() {
    retry.hidden = true;
    grid.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Loading studio news…';
    try {
      const response = await fetch('./news.json', { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('News request failed');
      const data = await response.json();
      if (!Array.isArray(data.cards)) throw new Error('Invalid news data');
      const cards = data.cards.filter(card => card && typeof card.title === 'string' && card.title.trim()
        && typeof card.summary === 'string').slice(0, 24);
      if (cards.length !== data.cards.length) throw new Error('Invalid news card');
      grid.replaceChildren(...cards.map(renderCard));
      status.hidden = cards.length > 0;
      status.textContent = cards.length ? '' : 'Studio updates are on their way. Check back soon.';
    } catch {
      status.textContent = 'Studio news is taking a moment to load.';
      retry.hidden = false;
    } finally { grid.setAttribute('aria-busy', 'false'); }
  }

  close.addEventListener('click', () => article.close());
  article.addEventListener('close', () => lastTrigger?.focus());
  retry.addEventListener('click', loadNews);
  loadNews();
})();
