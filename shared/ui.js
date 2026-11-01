/* Brain Playground - funzioni condivise da tutti i giochi */
window.BP = (() => {
  'use strict';

  /* ---------- Utilità ---------- */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage pieno o bloccato */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  };
  const fmt = s => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  };
  const randInt = n => Math.floor(Math.random() * n);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const $ = id => document.getElementById(id);
  const vibrate = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ } };

  /* ---------- Icone ---------- */
  const icons = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
    stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 5v14l12-7z"/>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    erase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
    notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>'
  };

  /* ---------- Header standard ---------- */
  function header(title, { stats = true, help = true, newLabel = 'Nuova' } = {}) {
    const h = document.querySelector('header.top');
    h.innerHTML = `
      <div class="top-left">
        <a class="icon-btn" href="../" aria-label="Torna ai giochi">${icons.back}</a>
        <div class="brand${title.length > 9 ? ' long' : ''}"><small>Brain Playground</small>${title}<span>.</span></div>
      </div>
      <div class="hbtns">
        ${help ? `<button class="icon-btn" id="btnHelp" aria-label="Regole">${icons.help}</button>` : ''}
        ${stats ? `<button class="icon-btn" id="btnStats" aria-label="Statistiche">${icons.stats}</button>` : ''}
        ${newLabel ? `<button class="pill" id="btnNew" aria-label="${newLabel}"><span class="lbl">${newLabel}</span><svg class="plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
      </div>`;
  }

  /* ---------- Fogli modali ---------- */
  let modal, sheetEl, handler = null, toastEl, toastT;
  function ensureDom() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = '<div class="sheet"></div>';
    sheetEl = modal.firstChild;
    document.body.appendChild(modal);
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
    modal.addEventListener('click', e => { if (e.target === modal && !modal.dataset.locked) closeSheet(); });
    sheetEl.addEventListener('click', e => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      if (t.dataset.act === 'close') { closeSheet(); return; }
      if (handler) handler(t.dataset.act, t.dataset, t);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sheetOpen() && !modal.dataset.locked) closeSheet();
    });
  }
  function sheet(html, { locked = false } = {}) {
    ensureDom();
    sheetEl.innerHTML = html;
    modal.classList.add('open');
    modal.dataset.locked = locked ? '1' : '';
  }
  function closeSheet() { ensureDom(); modal.classList.remove('open'); }
  const sheetOpen = () => !!modal && modal.classList.contains('open');
  const onSheet = fn => { handler = fn; };
  function toast(msg, ms = 1700) {
    ensureDom();
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  const loading = text => sheet(`<div class="loading"><div class="spinner"></div>${text}</div>`, { locked: true });

  /* ---------- Scelta livello ---------- */
  function levelPicker(levels, { title = 'Nuova partita', sub = 'Scegli la difficoltà.', canContinue = false, extra = '' } = {}) {
    const opts = Object.entries(levels).map(([k, L]) => `
      <button class="choice" data-act="level" data-level="${k}">
        <div><strong>${L.label}</strong><span>${L.desc || ''}</span></div>
        <div class="dots">${[1, 2, 3, 4].map(n => `<i class="${n <= (L.dots || 1) ? 'f' : ''}"></i>`).join('')}</div>
      </button>`).join('');
    sheet(`
      <h2>${title}</h2>
      <p class="sub">${canContinue ? 'La partita in corso verrà sostituita.' : sub}</p>
      <div class="choices">${opts}</div>
      ${extra}
      ${canContinue ? '<button class="ghost" data-act="close">Continua la partita</button>' : ''}
    `, { locked: !canContinue });
  }

  /* ---------- Statistiche per gioco (puzzle a tempo) ---------- */
  function Stats(key, levels) {
    const empty = () => Object.fromEntries(Object.keys(levels).map(k => [k, { played: 0, won: 0, best: null, total: 0 }]));
    const clean = saved => {
      const d = empty();
      for (const k of Object.keys(d)) {
        const v = saved && saved[k];
        if (!v || typeof v !== 'object') continue;
        for (const f of Object.keys(d[k])) if (Number.isFinite(v[f]) || (f === 'best' && v[f] === null)) d[k][f] = v[f];
      }
      return d;
    };
    let data = clean(store.get(key, {}));
    const save = () => store.set(key, data);
    return {
      get data() { return data; },
      played(level) { data[level].played++; save(); },
      won(level, seconds, { countsForRecord = true } = {}) {
        const s = data[level];
        s.won++; s.total += seconds;
        const record = countsForRecord && (s.best === null || seconds < s.best);
        if (record) s.best = seconds;
        save();
        return record;
      },
      reset() { data = empty(); save(); },
      html() {
        const tw = Object.values(data).reduce((a, s) => a + s.won, 0);
        const tp = Object.values(data).reduce((a, s) => a + s.played, 0);
        const rows = Object.entries(levels).map(([k, L]) => {
          const s = data[k];
          return `<tr><td>${L.label}</td><td>${s.won}/${s.played}</td><td>${s.best !== null ? fmt(s.best) : '-'}</td><td>${s.won ? fmt(Math.round(s.total / s.won)) : '-'}</td></tr>`;
        }).join('');
        return `
          <div class="stats-grid">
            <div class="stat"><b>${tw}</b><span>Vinte</span></div>
            <div class="stat"><b>${tp}</b><span>Giocate</span></div>
            <div class="stat"><b>${tp ? Math.round(tw / tp * 100) : 0}%</b><span>Completate</span></div>
          </div>
          <table><thead><tr><th>Livello</th><th>Vinte</th><th>Record</th><th>Media</th></tr></thead><tbody>${rows}</tbody></table>`;
      }
    };
  }
  function statsSheet(title, statsObj, extraHtml = '') {
    sheet(`
      <h2>${title}</h2>
      ${statsObj.html()}
      ${extraHtml}
      <button class="danger" data-act="resetStats">Azzera statistiche</button>
      <button class="primary" data-act="close">Chiudi</button>`);
  }
  const switchRow = (key, title, sub, on) => `
    <button class="setting" data-act="toggle" data-key="${key}">
      <div>${title}<small>${sub}</small></div><span class="switch ${on ? 'on' : ''}"></span>
    </button>`;

  /* ---------- Timer: conta solo con pagina visibile e nessun modale aperto ---------- */
  function ticker(fn) {
    setInterval(() => { if (!document.hidden && !sheetOpen()) fn(); }, 1000);
  }
  function setPauseIcon(svgEl, paused) { if (svgEl) svgEl.innerHTML = paused ? icons.play : icons.pause; }

  /* ---------- Service worker ---------- */
  function registerSW(path = '../sw.js') {
    // ricorda l'ultimo gioco usato (per l'ordine "Recenti" nella home): conta la prima interazione, non la sola apertura
    (() => {
      const id = location.pathname.split('/').filter(Boolean).pop();
      if (!/^[a-z0-9]+$/.test(id || '')) return;
      let marked = false;
      const mark = e => {
        if (marked || (e.target && e.target.closest && e.target.closest('a'))) return;
        marked = true;
        try {
          const r = JSON.parse(localStorage.getItem('bp.recent') || '{}') || {};
          r[id] = Date.now();
          localStorage.setItem('bp.recent', JSON.stringify(r));
        } catch { /* storage non disponibile */ }
      };
      document.addEventListener('pointerdown', mark, true);
      document.addEventListener('keydown', mark, true);
    })();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => navigator.serviceWorker.register(path).catch(() => {}));
    }
  }

  /* ---------- Swipe (per i giochi arcade) ---------- */
  function onSwipe(el, cb, min = 18) {
    let sx = 0, sy = 0, active = false;
    el.addEventListener('touchstart', e => {
      // il pad e i pulsanti hanno già i loro comandi
      if (e.target.closest && e.target.closest('.joy, button, a, .modal')) { active = false; return; }
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!active) return;
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      sx = t.clientX; sy = t.clientY;
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchend', () => { active = false; }, { passive: true });
  }

  /* ---------- Pad direzionale "a pollice": trascina senza staccare il dito ---------- */
  function joystick(el, cb, step = 14) {
    const knob = el.querySelector('.knob');
    let ax = 0, ay = 0, cx = 0, cy = 0, id = null, last = null;
    const setKnob = (dx, dy) => {
      if (!knob) return;
      const max = 34, d = Math.hypot(dx, dy), k = d > max ? max / d : 1;
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      id = e.pointerId; ax = cx = e.clientX; ay = cy = e.clientY; last = null;
      el.classList.add('active');
      try { el.setPointerCapture(id); } catch { /* ignore */ }
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - ax, dy = e.clientY - ay;
      setKnob(e.clientX - cx, e.clientY - cy);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < step) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      // il punto di riferimento si sposta: ogni svolta è relativa all'ultimo movimento
      ax = e.clientX; ay = e.clientY;
      if (dir !== last) { last = dir; vibrate(8); cb(dir); }
    });
    const end = e => { if (e.pointerId !== id) return; id = null; el.classList.remove('active'); setKnob(0, 0); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  return {
    joystick,
    store, fmt, randInt, shuffle, $, vibrate, icons, header,
    sheet, closeSheet, sheetOpen, onSheet, toast, loading, levelPicker,
    Stats, statsSheet, switchRow, ticker, setPauseIcon, registerSW, onSwipe
  };
})();
