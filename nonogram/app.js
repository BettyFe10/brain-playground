(() => {
'use strict';
const { $, store, fmt, icons } = BP;
const LEVELS = {
  facile:    { label: 'Piccolo', size: 5,  dots: 1, desc: '5x5, si risolve in un paio di minuti' },
  medio:     { label: 'Medio',   size: 10, dots: 2, desc: '10x10, il formato classico' },
  difficile: { label: 'Grande',  size: 15, dots: 3, desc: '15x15, per quando hai tempo' }
};
const K_GAME = 'bp.nonogram.game';
const stats = BP.Stats('bp.nonogram.stats', LEVELS);
let G = store.get(K_GAME, null);
let mode = 1, paused = false, cursor = -1;

BP.header('Nonogram');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnCheck').innerHTML = icons.check + 'Verifica';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Logica: indizi e risolutore per righe ============ */
function cluesOf(line) {
  const out = []; let run = 0;
  for (const v of line) { if (v === 1) run++; else if (run) { out.push(run); run = 0; } }
  if (run) out.push(run);
  return out.length ? out : [0];
}
// Dato lo stato noto di una riga (-1 ignoto, 0 vuoto, 1 pieno) deduce ciò che è certo.
function solveLine(cells, clues) {
  const n = cells.length;
  const cl = clues[0] === 0 ? [] : clues;
  const memo = new Map();
  const can = (i, j) => {
    const key = i * 64 + j;
    if (memo.has(key)) return memo.get(key);
    let res = false;
    if (j === cl.length) {
      res = true;
      for (let k = i; k < n; k++) if (cells[k] === 1) { res = false; break; }
    } else if (i < n) {
      if (cells[i] !== 1 && can(i + 1, j)) res = true;
      if (!res && fits(i, cl[j]) && can(Math.min(n, i + cl[j] + 1), j + 1)) res = true;
    }
    memo.set(key, res);
    return res;
  };
  const fits = (i, L) => {
    if (i + L > n) return false;
    for (let k = i; k < i + L; k++) if (cells[k] === 0) return false;
    return !(i + L < n && cells[i + L] === 1);
  };
  if (!can(0, 0)) return null;
  const canF = new Array(n).fill(false), canE = new Array(n).fill(false);
  const seen = new Set();
  const stack = [[0, 0]];
  while (stack.length) {
    const [i, j] = stack.pop();
    const key = i * 64 + j;
    if (seen.has(key)) continue;
    seen.add(key);
    if (j === cl.length) { for (let k = i; k < n; k++) canE[k] = true; continue; }
    if (i >= n) continue;
    if (cells[i] !== 1 && can(i + 1, j)) { canE[i] = true; stack.push([i + 1, j]); }
    if (fits(i, cl[j]) && can(Math.min(n, i + cl[j] + 1), j + 1)) {
      for (let k = i; k < i + cl[j]; k++) canF[k] = true;
      if (i + cl[j] < n) canE[i + cl[j]] = true;
      stack.push([Math.min(n, i + cl[j] + 1), j + 1]);
    }
  }
  return cells.map((v, k) => canF[k] && !canE[k] ? 1 : (!canF[k] && canE[k] ? 0 : v));
}
// true se il puzzle si risolve con sola logica riga/colonna (quindi ha soluzione unica)
function logicSolvable(n, rows, cols) {
  const g = new Array(n * n).fill(-1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 0; r < n; r++) {
      const line = g.slice(r * n, r * n + n);
      const res = solveLine(line, rows[r]);
      if (!res) return false;
      res.forEach((v, c) => { if (v !== line[c]) { g[r * n + c] = v; changed = true; } });
    }
    for (let c = 0; c < n; c++) {
      const line = []; for (let r = 0; r < n; r++) line.push(g[r * n + c]);
      const res = solveLine(line, cols[c]);
      if (!res) return false;
      res.forEach((v, r) => { if (v !== line[r]) { g[r * n + c] = v; changed = true; } });
    }
  }
  return g.every(v => v !== -1);
}
function generate(level) {
  const n = LEVELS[level].size;
  for (let attempt = 0; attempt < 400; attempt++) {
    const density = 0.55 + Math.random() * 0.1;
    const sol = Array.from({ length: n * n }, () => Math.random() < density ? 1 : 0);
    const rows = [], cols = [];
    for (let r = 0; r < n; r++) rows.push(cluesOf(sol.slice(r * n, r * n + n)));
    for (let c = 0; c < n; c++) { const l = []; for (let r = 0; r < n; r++) l.push(sol[r * n + c]); cols.push(cluesOf(l)); }
    if (rows.some(x => x[0] === 0) || cols.some(x => x[0] === 0)) continue;
    if (logicSolvable(n, rows, cols)) return { n, sol, rows, cols };
  }
  return null;
}

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  BP.loading('Disegno qualcosa per te...');
  setTimeout(() => {
    const p = generate(level) || generate(level);
    G = { level, n: p.n, sol: p.sol, rows: p.rows, cols: p.cols, state: new Array(p.n * p.n).fill(0),
      elapsed: 0, checks: 0, hints: 0, done: false, history: [] };
    stats.played(level);
    paused = false; cursor = -1;
    save(); BP.closeSheet(); build(); render();
  }, 30);
}

/* ============ Costruzione della griglia ============ */
const board = $('board');
let cellEls = [], rcEls = [], ccEls = [];
function build() {
  const n = G.n;
  board.classList.remove('won');
  board.style.gridTemplateColumns = `auto repeat(${n}, var(--cs))`;
  board.innerHTML = '';
  cellEls = []; rcEls = []; ccEls = [];
  board.appendChild(Object.assign(document.createElement('div'), { className: 'corner' }));
  for (let c = 0; c < n; c++) {
    const el = document.createElement('div');
    el.className = 'cc' + (Math.floor(c / 5) % 2 ? ' alt' : '');
    el.innerHTML = G.cols[c].map(v => `<span>${v}</span>`).join('');
    board.appendChild(el); ccEls.push(el);
  }
  for (let r = 0; r < n; r++) {
    const rc = document.createElement('div');
    rc.className = 'rc' + (Math.floor(r / 5) % 2 ? ' alt' : '');
    rc.innerHTML = G.rows[r].map(v => `<span>${v}</span>`).join('');
    board.appendChild(rc); rcEls.push(rc);
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const el = document.createElement('div');
      el.className = 'cell';
      if (c === 0) el.classList.add('bl');
      if (r === 0) el.classList.add('bt');
      if (c % 5 === 4 || c === n - 1) el.classList.add('br');
      if (r % 5 === 4 || r === n - 1) el.classList.add('bb');
      el.dataset.i = i;
      board.appendChild(el); cellEls.push(el);
    }
  }
  resize();
}
function resize() {
  if (!G) return;
  const n = G.n;
  const stage = $('stage');
  const W = Math.min(stage.clientWidth || window.innerWidth - 32, 640) - 12;
  const maxR = Math.max(...G.rows.map(x => x.length));
  const maxC = Math.max(...G.cols.map(x => x.length));
  const wide = window.matchMedia('(min-width:880px) and (min-height:560px)').matches;
  const H = wide ? window.innerHeight - 140 : window.innerHeight * 0.62;
  const byW = W / (n + Math.max(1.1, maxR * 0.62 + 0.3));
  const byH = H / (n + Math.max(1, maxC * 0.56 + 0.3));
  board.style.setProperty('--cs', Math.floor(Math.min(byW, byH, 52)) + 'px');
}
window.addEventListener('resize', resize);

/* ============ Rendering ============ */
function lineOk(cells, clue) { const a = cluesOf(cells); return a.length === clue.length && a.every((v, k) => v === clue[k]); }
function render() {
  if (!G) return;
  const n = G.n;
  const cr = cursor >= 0 ? Math.floor(cursor / n) : -1, ccol = cursor >= 0 ? cursor % n : -1;
  for (let i = 0; i < n * n; i++) {
    const el = cellEls[i], s = G.state[i];
    el.classList.toggle('f', s === 1);
    el.classList.toggle('x', s === 2);
    el.classList.toggle('hl', cursor >= 0 && (Math.floor(i / n) === cr || i % n === ccol) && !G.done);
    if (!G.wrongShown) el.classList.remove('wrong');
  }
  for (let r = 0; r < n; r++) {
    const line = G.state.slice(r * n, r * n + n).map(v => v === 1 ? 1 : 0);
    rcEls[r].classList.toggle('done', lineOk(line, G.rows[r]));
    rcEls[r].classList.toggle('cur', r === cr);
  }
  for (let c = 0; c < n; c++) {
    const line = []; for (let r = 0; r < n; r++) line.push(G.state[r * n + c] === 1 ? 1 : 0);
    ccEls[c].classList.toggle('done', lineOk(line, G.cols[c]));
    ccEls[c].classList.toggle('cur', c === ccol);
  }
  $('lvl').textContent = LEVELS[G.level].label;
  $('checks').textContent = G.checks;
  $('hints').textContent = G.hints;
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('stage').classList.toggle('paused', paused && !G.done);
  BP.setPauseIcon($('pauseIcon'), paused);
  board.classList.toggle('won', G.done);
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', +b.dataset.mode === mode));
}

/* ============ Interazione ============ */
function pushHistory() { G.history.push(G.state.slice()); if (G.history.length > 200) G.history.shift(); }
function checkWin() {
  const n = G.n, filled = G.state.map(v => v === 1 ? 1 : 0);
  for (let r = 0; r < n; r++) if (!lineOk(filled.slice(r * n, r * n + n), G.rows[r])) return;
  for (let c = 0; c < n; c++) { const l = []; for (let r = 0; r < n; r++) l.push(filled[r * n + c]); if (!lineOk(l, G.cols[c])) return; }
  G.done = true; cursor = -1;
  const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
  save(); render();
  setTimeout(() => BP.sheet(`
    <h2>Completato!</h2>
    <p class="sub">${LEVELS[G.level].label}${!record && G.hints ? ' - con aiuti il tempo non vale come record' : ''}</p>
    ${record ? '<span class="record">Nuovo record</span>' : ''}
    <div class="stats-grid">
      <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
      <div class="stat"><b>${G.checks}</b><span>Controlli</span></div>
      <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
    </div>
    <button class="primary" data-act="new">Nuovo disegno</button>
    <button class="ghost" data-act="close">Guarda il disegno</button>`), 900);
}

// Trascinamento: la prima casella decide il valore, poi il tratto resta su una riga o colonna
let drag = null;
function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el.classList && el.classList.contains('cell') ? +el.dataset.i : -1;
}
function applyPaint(i) {
  if (drag.done.has(i)) return;
  const cur = G.state[i];
  // non sovrascrive celle con un segno diverso da quello di partenza
  if (drag.value === 0 ? cur !== drag.from : (cur !== 0 && cur !== drag.from)) return;
  drag.done.add(i);
  G.state[i] = drag.value;
}
board.addEventListener('pointerdown', e => {
  if (!G || G.done || paused) return;
  const i = cellFromPoint(e.clientX, e.clientY);
  if (i < 0) return;
  e.preventDefault();
  const tool = e.button === 2 ? 2 : mode;
  const cur = G.state[i];
  pushHistory();
  drag = { start: i, value: cur === tool ? 0 : tool, from: cur, axis: null, done: new Set() };
  G.wrongShown = false;
  applyPaint(i);
  cursor = i;
  render();
});
board.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointermove', e => {
  if (!drag) return;
  let i = cellFromPoint(e.clientX, e.clientY);
  if (i < 0) return;
  const n = G.n, sr = Math.floor(drag.start / n), sc = drag.start % n;
  const r = Math.floor(i / n), c = i % n;
  if (!drag.axis && i !== drag.start) drag.axis = r === sr ? 'row' : (c === sc ? 'col' : (Math.abs(r - sr) < Math.abs(c - sc) ? 'row' : 'col'));
  if (drag.axis === 'row') i = sr * n + c;
  if (drag.axis === 'col') i = r * n + sc;
  // riempie anche le caselle saltate da un movimento veloce
  const a = drag.axis === 'row' ? sc : sr, b = drag.axis === 'row' ? c : r;
  for (let k = Math.min(a, b); k <= Math.max(a, b); k++) applyPaint(drag.axis === 'row' ? sr * n + k : k * n + sc);
  cursor = i;
  render();
});
const endDrag = () => {
  if (!drag) return;
  if (!drag.done.size || drag.done.size === 1 && G.state[drag.start] === drag.from) G.history.pop();
  drag = null;
  save(); checkWin();
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function undo() {
  if (!G || G.done || !G.history.length) return;
  G.state = G.history.pop(); G.wrongShown = false; save(); render();
}
function check() {
  if (!G || G.done || paused) return;
  let wrong = 0;
  G.state.forEach((s, i) => {
    const bad = (s === 1 && G.sol[i] === 0) || (s === 2 && G.sol[i] === 1);
    cellEls[i].classList.toggle('wrong', bad);
    if (bad) wrong++;
  });
  G.checks++; G.wrongShown = true; save(); render();
  BP.toast(wrong ? `${wrong} ${wrong === 1 ? 'casella sbagliata' : 'caselle sbagliate'}` : 'Finora tutto giusto');
  setTimeout(() => { G.wrongShown = false; cellEls.forEach(el => el.classList.remove('wrong')); }, 2500);
}
function hint() {
  if (!G || G.done || paused) return;
  // rivela una casella piena non ancora segnata (o corregge un errore)
  const cand = [];
  G.state.forEach((s, i) => { if ((G.sol[i] === 1 && s !== 1) || (s === 1 && G.sol[i] === 0)) cand.push(i); });
  if (!cand.length) return;
  const i = cand[BP.randInt(cand.length)];
  pushHistory();
  G.state[i] = G.sol[i] === 1 ? 1 : 2;
  G.hints++;
  cellEls[i].classList.remove('hintc'); void cellEls[i].offsetWidth; cellEls[i].classList.add('hintc');
  save(); render(); checkWin();
}
function restart() {
  if (!G || !confirm('Cancellare tutto e ricominciare questo disegno?')) return;
  G.state = new Array(G.n * G.n).fill(0); G.history = []; G.elapsed = 0; G.checks = 0; G.hints = 0; G.done = false;
  save(); build(); render();
}
function togglePause(force) {
  if (!G || G.done) return;
  paused = typeof force === 'boolean' ? force : !paused; render();
}

$('btnUndo').onclick = undo;
$('btnCheck').onclick = check;
$('btnHint').onclick = hint;
$('btnRestart').onclick = restart;
$('btnPause').onclick = () => togglePause();
$('pauseOverlay').onclick = () => togglePause(false);
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => { mode = +b.dataset.mode; render(); });
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`
  <h2>Come si gioca</h2>
  <ul class="rules">
    <li>I numeri accanto a ogni riga e sopra ogni colonna dicono quanti blocchi di caselle piene ci sono, e in che ordine.</li>
    <li>"3 1" significa: un blocco di 3 caselle, almeno una vuota, poi un blocco di 1.</li>
    <li>Usa <b>Croce</b> per segnare le caselle che sei sicura siano vuote.</li>
    <li>Quando una riga è giusta i suoi numeri diventano grigi.</li>
    <li>Alla fine appare un disegno astratto, ogni volta diverso.</li>
  </ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});

document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G || G.done) return;
  const n = G.n;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) {
    e.preventDefault();
    if (cursor < 0) cursor = 0;
    else { const r = (Math.floor(cursor / n) + mv[0] + n) % n, c = (cursor % n + mv[1] + n) % n; cursor = r * n + c; }
    render(); return;
  }
  if (cursor < 0) return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter' || k === 'x') {
    e.preventDefault();
    const tool = k === 'x' ? 2 : 1;
    pushHistory();
    G.state[cursor] = G.state[cursor] === tool ? 0 : tool;
    save(); render(); checkWin();
  }
});

BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++;
  $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const validSave = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size && Array.isArray(g.sol) && g.sol.length === g.n * g.n &&
  Array.isArray(g.state) && g.state.length === g.n * g.n && Array.isArray(g.rows) && g.rows.length === g.n && Array.isArray(g.cols) && g.cols.length === g.n &&
  [...g.rows, ...g.cols].every(l => Array.isArray(l) && l.every(Number.isInteger));
try {
  if (!validSave(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.elapsed = +G.elapsed || 0; G.wrongShown = false; build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate, logicSolvable };
})();
