(() => {
'use strict';

/* ============ Geometria della griglia ============ */
const R = [], C = [], B = [], PEERS = [];
for (let i = 0; i < 81; i++) {
  R[i] = Math.floor(i / 9);
  C[i] = i % 9;
  B[i] = Math.floor(R[i] / 3) * 3 + Math.floor(C[i] / 3);
}
for (let i = 0; i < 81; i++) {
  const p = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (R[i] === R[j] || C[i] === C[j] || B[i] === B[j])) p.push(j);
  }
  PEERS[i] = p;
}
const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============ Solver a bitmask (conta soluzioni fino a "limit") ============ */
function search(grid, limit, randomize) {
  const a = grid.slice();
  const r = new Int32Array(9), c = new Int32Array(9), b = new Int32Array(9);
  for (let i = 0; i < 81; i++) {
    const v = a[i];
    if (!v) continue;
    const m = 1 << v;
    if ((r[R[i]] | c[C[i]] | b[B[i]]) & m) return { count: 0, solution: null };
    r[R[i]] |= m; c[C[i]] |= m; b[B[i]] |= m;
  }
  let count = 0, first = null;
  const rec = () => {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (a[i]) continue;
      const m = ~(r[R[i]] | c[C[i]] | b[B[i]]) & 0x3FE;
      const n = popcount(m);
      if (n < bestCount) { best = i; bestMask = m; bestCount = n; if (n < 2) break; }
    }
    if (best < 0) { count++; if (!first) first = a.slice(); return count >= limit; }
    if (bestCount === 0) return false;
    const digits = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (randomize) shuffle(digits);
    for (const d of digits) {
      const m = 1 << d;
      a[best] = d; r[R[best]] |= m; c[C[best]] |= m; b[B[best]] |= m;
      if (rec()) return true;
      r[R[best]] &= ~m; c[C[best]] &= ~m; b[B[best]] &= ~m; a[best] = 0;
    }
    return false;
  };
  rec();
  return { count, solution: first };
}

/* ============ Generatore con soluzione unica ============ */
const LEVELS = {
  facile:    { label: 'Facile',    clues: 38, dots: 1, desc: 'Per scaldarsi' },
  medio:     { label: 'Medio',     clues: 32, dots: 2, desc: 'Il classico da giornale' },
  difficile: { label: 'Difficile', clues: 27, dots: 3, desc: 'Servono le note' },
  esperto:   { label: 'Esperto',   clues: 22, dots: 4, desc: 'Pochi numeri, tanta pazienza' }
};
function carve(level) {
  const solution = search(new Array(81).fill(0), 1, true).solution;
  const puzzle = solution.slice();
  let clues = 81;
  const target = LEVELS[level].clues;
  const tryRemove = cellsToRemove => {
    const saved = cellsToRemove.map(i => puzzle[i]);
    cellsToRemove.forEach(i => puzzle[i] = 0);
    if (search(puzzle, 2, false).count === 1) { clues -= cellsToRemove.length; return true; }
    cellsToRemove.forEach((i, k) => puzzle[i] = saved[k]);
    return false;
  };
  // 1) rimozione simmetrica (coppie i / 80-i): griglia più elegante
  for (const i of shuffle([...Array(41).keys()])) {
    if (clues <= target) break;
    if (puzzle[i]) tryRemove(i === 40 ? [40] : [i, 80 - i]);
  }
  // 2) se non basta, rimozione singola per arrivare al target
  for (const i of shuffle([...Array(81).keys()])) {
    if (clues <= target) break;
    if (puzzle[i]) tryRemove([i]);
  }
  return { puzzle, solution, clues };
}
function generate(level) {
  // per i livelli alti prova più griglie e tiene quella con meno numeri
  const tries = level === 'esperto' ? 6 : level === 'difficile' ? 3 : 1;
  let best = null;
  for (let t = 0; t < tries; t++) {
    const g = carve(level);
    if (!best || g.clues < best.clues) best = g;
    if (best.clues <= LEVELS[level].clues) break;
  }
  return { puzzle: best.puzzle, solution: best.solution };
}

/* ============ Persistenza ============ */
const K_GAME = 'sudoku.game.v1', K_SET = 'sudoku.settings.v1', K_STATS = 'sudoku.stats.v1';
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage pieno o bloccato */ } }
};
const emptyStats = () => Object.fromEntries(Object.keys(LEVELS).map(k => [k, { played: 0, won: 0, best: null, total: 0, noErr: 0 }]));
let settings = Object.assign({ showErrors: true, autoNotes: true, highlight: true }, store.get(K_SET, {}));
let stats = emptyStats();
(() => { const saved = store.get(K_STATS, {}); for (const k of Object.keys(stats)) { const v = saved && saved[k]; if (v && typeof v === 'object') for (const f of Object.keys(stats[k])) if (typeof v[f] === 'number' || (f === 'best' && v[f] === null)) stats[k][f] = v[f]; } })();
let S = store.get(K_GAME, null);          // stato partita
let sel = -1, notesMode = false, paused = false, lastPlaced = -1;

const saveGame = () => { if (S) store.set(K_GAME, S); };
const saveSettings = () => store.set(K_SET, settings);
const saveStats = () => store.set(K_STATS, stats);

/* ============ DOM ============ */
const $ = id => document.getElementById(id);
const boardEl = $('board'), padEl = $('pad'), appEl = $('app');
const cells = [];
for (let i = 0; i < 81; i++) {
  const el = document.createElement('div');
  el.className = 'cell';
  if (C[i] === 8) el.classList.add('c8');
  if (R[i] === 8) el.classList.add('r8');
  if (C[i] === 2 || C[i] === 5) el.classList.add('bR');
  if (R[i] === 2 || R[i] === 5) el.classList.add('bB');
  el.setAttribute('role', 'gridcell');
  el.addEventListener('pointerdown', e => { e.preventDefault(); select(i); });
  boardEl.appendChild(el);
  cells.push(el);
}
const padBtns = [];
for (let d = 1; d <= 9; d++) {
  const b = document.createElement('button');
  b.className = 'num';
  b.innerHTML = `${d}<small></small>`;
  b.setAttribute('aria-label', `Numero ${d}`);
  b.addEventListener('click', () => input(d));
  padEl.appendChild(b);
  padBtns.push(b);
}

/* ============ Rendering ============ */
const fmt = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

function render() {
  if (!S) return;
  const selVal = sel >= 0 ? S.values[sel] : 0;
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (S.values[i]) counts[S.values[i]]++;

  for (let i = 0; i < 81; i++) {
    const el = cells[i], v = S.values[i], given = S.puzzle[i] !== 0;
    const isErr = settings.showErrors && v && !given && v !== S.solution[i];
    el.classList.toggle('given', given);
    el.classList.toggle('user', !given && !!v);
    el.classList.toggle('err', !!isErr);
    el.classList.toggle('sel', i === sel);
    el.classList.toggle('peer', settings.highlight && sel >= 0 && i !== sel && PEERS[sel].includes(i));
    el.classList.toggle('same', settings.highlight && !!selVal && i !== sel && v === selVal);
    el.classList.toggle('pop', i === lastPlaced);

    let html = '';
    if (v) html = String(v);
    else if (S.notes[i]) {
      html = '<div class="notes">';
      for (let d = 1; d <= 9; d++) {
        const on = S.notes[i] & (1 << d);
        html += `<i class="${on && d === selVal ? 'hit' : ''}">${on ? d : ''}</i>`;
      }
      html += '</div>';
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    el.setAttribute('aria-label', `Riga ${R[i] + 1}, colonna ${C[i] + 1}${v ? ', ' + v : ', vuota'}`);
  }
  lastPlaced = -1;

  padBtns.forEach((b, k) => {
    const d = k + 1, left = 9 - counts[d];
    b.classList.toggle('done', left <= 0);
    b.querySelector('small').textContent = left > 0 ? left : '';
  });

  $('diffLabel').textContent = LEVELS[S.level].label;
  $('errs').textContent = S.errors;
  $('hints').textContent = S.hints;
  $('errWrap').style.visibility = settings.showErrors ? 'visible' : 'hidden';
  $('timer').textContent = fmt(S.elapsed);
  $('btnUndo').disabled = !S.history.length || S.done;
  $('btnNotes').classList.toggle('on', notesMode);
  $('notesBadge').textContent = notesMode ? 'ON' : 'OFF';
  appEl.classList.toggle('notes-on', notesMode);
  $('boardWrap').classList.toggle('paused', paused && !S.done);
  $('pauseIcon').innerHTML = paused
    ? '<path d="M7 5v14l12-7z"/>'
    : '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
}

/* ============ Azioni di gioco ============ */
function select(i) {
  if (!S || paused) return;
  sel = i;
  render();
}
function pushHistory() {
  S.history.push([S.values.slice(), S.notes.slice()]);
  if (S.history.length > 150) S.history.shift();
}
function clearPeerNotes(i, d) {
  for (const p of PEERS[i]) S.notes[p] &= ~(1 << d);
}
function input(d) {
  if (!S || S.done || paused) return;
  if (sel < 0) { toast('Seleziona prima una casella'); return; }
  const i = sel;
  if (S.puzzle[i]) return;

  if (notesMode) {
    if (S.values[i]) return;
    pushHistory();
    S.notes[i] ^= (1 << d);
  } else {
    pushHistory();
    if (S.values[i] === d) {              // stesso numero: lo toglie
      S.values[i] = 0;
    } else {
      S.values[i] = d;
      S.notes[i] = 0;
      lastPlaced = i;
      if (d === S.solution[i] && window.BP) BP.sfx('tap');
      if (d !== S.solution[i]) {
        S.errors++;
        if (window.BP) BP.fx('error', 60); else if (navigator.vibrate) navigator.vibrate(60);
      }
      if (settings.autoNotes) clearPeerNotes(i, d);
    }
  }
  afterMove();
}
function erase() {
  if (!S || S.done || paused || sel < 0 || S.puzzle[sel]) return;
  if (!S.values[sel] && !S.notes[sel]) return;
  pushHistory();
  S.values[sel] = 0;
  S.notes[sel] = 0;
  afterMove();
}
function undo() {
  if (!S || S.done || paused || !S.history.length) return;
  const [v, n] = S.history.pop();
  S.values = v; S.notes = n;
  afterMove();
}
function hint() {
  if (!S || S.done || paused) return;
  const needs = i => !S.puzzle[i] && S.values[i] !== S.solution[i];
  let target = sel >= 0 && needs(sel) ? sel : -1;
  if (target < 0) {
    // sceglie la casella vuota più vincolata: l'aiuto è più utile lì
    let bestN = 99;
    for (let i = 0; i < 81; i++) {
      if (!needs(i)) continue;
      const used = new Set(PEERS[i].map(p => S.values[p]).filter(Boolean));
      const n = 9 - used.size;
      if (n < bestN) { bestN = n; target = i; }
    }
  }
  if (target < 0) return;
  pushHistory();
  S.values[target] = S.solution[target];
  S.notes[target] = 0;
  clearPeerNotes(target, S.solution[target]);
  S.hints++;
  sel = target;
  lastPlaced = target;
  afterMove();
}
function afterMove() {
  if (S.values.every((v, i) => v === S.solution[i])) win();
  render();
  saveGame();
}
function toggleNotes() { notesMode = !notesMode; render(); }
function togglePause(force) {
  if (!S || S.done) return;
  paused = typeof force === 'boolean' ? force : !paused;
  render();
}

/* ============ Timer ============ */
setInterval(() => {
  if (!S || S.done || paused || document.hidden || $('modal').classList.contains('open')) return;
  S.elapsed++;
  $('timer').textContent = fmt(S.elapsed);
  if (S.elapsed % 5 === 0) saveGame();
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

/* ============ Nuova partita / vittoria ============ */
function startGame(level) {
  showSheet(`<div class="loading"><div class="spinner"></div>Preparo una griglia ${LEVELS[level].label.toLowerCase()}...</div>`, true);
  setTimeout(() => {
    const { puzzle, solution } = generate(level);
    S = {
      level, puzzle, solution,
      values: puzzle.slice(), notes: new Array(81).fill(0),
      errors: 0, hints: 0, elapsed: 0, done: false, history: [], created: Date.now()
    };
    stats[level].played++;
    saveStats();
    sel = -1; notesMode = false; paused = false;
    boardEl.classList.remove('won');
    saveGame();
    closeSheet();
    render();
  }, 40);
}
function win() {
  if (S.done) return;
  if (window.BP) BP.sfx('win');
  S.done = true;
  sel = -1;
  const st = stats[S.level];
  st.won++;
  st.total += S.elapsed;
  if (!S.errors && !S.hints) st.noErr++;
  const record = !S.hints && (st.best === null || S.elapsed < st.best);
  if (record) st.best = S.elapsed;
  saveStats();
  saveGame();
  boardEl.classList.add('won');
  cells.forEach((el, i) => el.style.animationDelay = ((R[i] + C[i]) * 35) + 'ms');
  setTimeout(() => {
    cells.forEach(el => el.style.animationDelay = '');
    showSheet(`
      <h2>Risolto!</h2>
      <p class="sub">${LEVELS[S.level].label}${record ? '' : (S.hints ? ' - con aiuti il tempo non vale come record' : '')}</p>
      ${record ? '<span class="record">Nuovo record</span>' : ''}
      <div class="stats-grid">
        <div class="stat"><b>${fmt(S.elapsed)}</b><span>Tempo</span></div>
        <div class="stat"><b>${S.errors}</b><span>Errori</span></div>
        <div class="stat"><b>${S.hints}</b><span>Aiuti</span></div>
      </div>
      <button class="primary" data-act="new">Nuova partita</button>
      <button class="ghost" data-act="close">Guarda la griglia</button>
    `);
  }, 900);
}

/* ============ Fogli modali ============ */
function showSheet(html, locked = false) {
  $('sheet').innerHTML = html;
  $('modal').classList.add('open');
  $('modal').dataset.locked = locked ? '1' : '';
}
function closeSheet() { $('modal').classList.remove('open'); }
$('modal').addEventListener('click', e => {
  if (e.target === $('modal') && !$('modal').dataset.locked) closeSheet();
});
$('sheet').addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  if (act === 'close') closeSheet();
  else if (act === 'new') showNewGame();
  else if (act === 'level') startGame(t.dataset.level);
  else if (act === 'toggle') {
    settings[t.dataset.key] = !settings[t.dataset.key];
    saveSettings();
    t.querySelector('.switch').classList.toggle('on', settings[t.dataset.key]);
    render();
  } else if (act === 'reset') {
    if (confirm('Azzerare tutte le statistiche?')) { stats = emptyStats(); saveStats(); showStats(); }
  } else if (act === 'restart') {
    if (confirm('Ricominciare questa griglia da capo?')) {
      S.values = S.puzzle.slice(); S.notes = new Array(81).fill(0);
      S.errors = 0; S.hints = 0; S.elapsed = 0; S.history = []; S.done = false;
      boardEl.classList.remove('won');
      sel = -1; saveGame(); closeSheet(); render();
    }
  }
});

function showNewGame(firstRun = false) {
  const opts = Object.entries(LEVELS).map(([k, L]) => `
    <button class="choice" data-act="level" data-level="${k}">
      <div><strong>${L.label}</strong><span>${L.desc}</span></div>
      <div class="dots">${[1,2,3,4].map(n => `<i class="${n <= L.dots ? 'f' : ''}"></i>`).join('')}</div>
    </button>`).join('');
  const canContinue = !firstRun && S && !S.done;
  showSheet(`
    <h2>Nuova partita</h2>
    <p class="sub">${canContinue ? 'La partita in corso verrà sostituita.' : 'Scegli la difficoltà.'}</p>
    <div class="choices">${opts}</div>
    ${canContinue ? '<button class="ghost" data-act="restart">Ricomincia questa griglia</button><button class="ghost" data-act="close" style="margin-top:0">Continua la partita</button>' : ''}
  `, firstRun);
}

function showStats() {
  const tw = Object.values(stats).reduce((a, s) => a + s.won, 0);
  const tp = Object.values(stats).reduce((a, s) => a + s.played, 0);
  const rows = Object.entries(LEVELS).map(([k, L]) => {
    const s = stats[k];
    return `<tr><td>${L.label}</td><td>${s.won}/${s.played}</td><td>${s.best !== null ? fmt(s.best) : '-'}</td><td>${s.won ? fmt(Math.round(s.total / s.won)) : '-'}</td></tr>`;
  }).join('');
  const sw = (key, title, sub) => `
    <button class="setting" data-act="toggle" data-key="${key}" style="width:100%;text-align:left">
      <div>${title}<small>${sub}</small></div><span class="switch ${settings[key] ? 'on' : ''}"></span>
    </button>`;
  showSheet(`
    <h2>Statistiche</h2>
    <div class="stats-grid">
      <div class="stat"><b>${tw}</b><span>Vinte</span></div>
      <div class="stat"><b>${tp ? Math.round(tw / tp * 100) : 0}%</b><span>Completate</span></div>
      <div class="stat"><b>${Object.values(stats).reduce((a, s) => a + s.noErr, 0)}</b><span>Perfette</span></div>
    </div>
    <table><thead><tr><th>Livello</th><th>Vinte</th><th>Record</th><th>Media</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="section-title">Impostazioni</div>
    ${sw('showErrors', 'Mostra errori', 'Colora in rosso i numeri sbagliati')}
    ${sw('autoNotes', 'Note automatiche', 'Inserendo un numero lo toglie dalle note vicine')}
    ${sw('highlight', 'Evidenziazioni', 'Riga, colonna, quadrato e numeri uguali')}
    <button class="danger" data-act="reset">Azzera statistiche</button>
    <button class="primary" data-act="close">Chiudi</button>
  `);
}

/* ============ Toast ============ */
let toastT;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ============ Eventi ============ */
$('btnNew').addEventListener('click', () => showNewGame());
$('btnStats').addEventListener('click', showStats);
$('btnUndo').addEventListener('click', undo);
$('btnErase').addEventListener('click', erase);
$('btnNotes').addEventListener('click', toggleNotes);
$('btnHint').addEventListener('click', hint);
$('btnPause').addEventListener('click', () => togglePause());
$('pauseOverlay').addEventListener('click', () => togglePause(false));

document.addEventListener('keydown', e => {
  if ($('modal').classList.contains('open')) { if (e.key === 'Escape' && !$('modal').dataset.locked) closeSheet(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (/^[1-9]$/.test(e.key)) { input(+e.key); return; }
  if (['Backspace', 'Delete', '0'].includes(e.key)) { erase(); return; }
  if (e.key.toLowerCase() === 'n') { toggleNotes(); return; }
  if (e.key.toLowerCase() === 'h') { hint(); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (moves[e.key] !== undefined) {
    e.preventDefault();
    if (sel < 0) { select(40); return; }
    let r = R[sel], c = C[sel];
    if (e.key === 'ArrowUp') r = (r + 8) % 9;
    if (e.key === 'ArrowDown') r = (r + 1) % 9;
    if (e.key === 'ArrowLeft') c = (c + 8) % 9;
    if (e.key === 'ArrowRight') c = (c + 1) % 9;
    select(r * 9 + c);
  }
});

/* ============ Avvio ============ */
const validSave = s => s && LEVELS[s.level] && ['puzzle', 'solution', 'values', 'notes'].every(k => Array.isArray(s[k]) && s[k].length === 81);
try {
  if (!validSave(S)) throw new Error('salvataggio non valido');
  if (!Array.isArray(S.history)) S.history = [];
  S.elapsed = +S.elapsed || 0;
  render();
} catch {
  S = null;
  try { localStorage.removeItem(K_GAME); } catch { /* ignore */ }
  showNewGame(true);
}

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
  window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
}
window.__sudoku = { get state() { return S; }, generate, search };
})();
