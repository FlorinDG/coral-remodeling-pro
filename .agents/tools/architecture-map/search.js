(() => {
  // Search over every roadmap item: ID first (exact, then prefix), then words in task / notes / source / where.
  // "/" focuses, Esc clears, ↑↓ + Enter jump to an item's row in the stack. #ENT-6 in the URL opens that item.
  let ITEMS = [];
  try { ITEMS = JSON.parse(document.getElementById('items').textContent); } catch (e) { return; }
  const q = document.getElementById('q');
  const out = document.getElementById('results');
  const count = document.getElementById('qcount');
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const idx = ITEMS.map(it => ({ it, id: norm(it.id), hay: norm([it.id, it.task, it.notes, it.source, it.where, it.module, it.status].join(' ')) }));
  let sel = 0, shown = [];

  function mark(text, terms) {
    let h = esc(text);
    for (const t of terms) {
      if (t.length < 2) continue;
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      h = h.replace(re, '<mark>$1</mark>');
    }
    return h;
  }

  function search(raw) {
    const s = norm(raw.trim());
    if (!s) return [];
    const terms = s.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const x of idx) {
      let score = -1;
      if (x.id === s) score = 1000;
      else if (x.id.startsWith(s)) score = 500 - x.id.length;
      else if (terms.every(t => x.hay.includes(t))) score = (x.id.includes(s) ? 200 : 0) + (x.it.open ? 50 : 0) + (x.it.prio === 'P0' ? 10 : 0);
      if (score >= 0) scored.push([score, x.it]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i);
    return scored.map(p => p[1]);
  }

  function render() {
    const raw = q.value;
    const res = search(raw);
    const terms = norm(raw.trim()).split(/\s+/).filter(Boolean);
    shown = res.slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    if (!raw.trim()) { out.hidden = true; count.textContent = ''; return; }
    count.textContent = res.length ? `${res.length} match${res.length === 1 ? '' : 'es'}${res.length > 40 ? ' · first 40' : ''}` : 'nothing found';
    out.hidden = false;
    out.innerHTML = shown.map((it, k) => {
      const st = it.open ? '' : ' closed';
      const p0 = it.open && it.prio === 'P0' ? ' p0' : '';
      return `<div class="res${st}${p0}${k === sel ? ' sel' : ''}" data-i="${it.i}">
        <div class="rh"><span class="rid">${mark(it.id, terms)}</span><span class="rpr">${esc(it.prio)}</span>
          <span class="rst">${esc(it.status)}</span><span class="rwh">${esc(it.where || '')}</span>
          <button type="button" class="rgo" data-i="${it.i}" title="Show in the stack">↧ in map</button></div>
        <div class="rtx">${mark(it.task, terms)}</div>
        ${it.notes ? `<div class="rno">${mark(it.notes, terms)}</div>` : ''}
        ${it.source ? `<div class="rsrc">${mark(it.source, terms)}</div>` : ''}
      </div>`;
    }).join('');
  }

  function jump(i) {
    const row = document.querySelector(`.tr[data-i="${i}"]`);
    if (!row) return;
    const d = row.closest('details');
    if (d) d.open = true;
    document.querySelectorAll('.tr.hit').forEach(r => r.classList.remove('hit'));
    row.classList.add('hit');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  q.addEventListener('input', () => { sel = 0; render(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { q.value = ''; render(); q.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); render(); out.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); out.querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); jump(shown[sel].i); }
  });
  out.addEventListener('click', e => {
    const b = e.target.closest('.rgo');
    if (b) jump(+b.dataset.i);
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== q && !/input|textarea/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); q.focus(); q.select(); }
  });
  // Clicking an ID in the stack searches it (full text + notes appear above).
  document.addEventListener('click', e => {
    const t = e.target.closest('.tr .tid');
    if (!t) return;
    q.value = t.textContent; sel = 0; render();
    document.getElementById('search').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); if (h) { q.value = h; sel = 0; render(); } };
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
