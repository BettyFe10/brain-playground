(() => {
'use strict';
const { $, store, fmt, icons, shuffle } = BP;
const LEVELS = {
  facile:    { label: '6x6',   size: 6,  dots: 1, desc: 'Due minuti di pausa' },
  medio:     { label: '8x8',   size: 8,  dots: 2, desc: 'Il formato più comune' },
  difficile: { label: '10x10', size: 10, dots: 3, desc: 'Serve tenere d\'occhio le righe uguali' },
  esperto:   { label: '12x12', size: 12, dots: 4, desc: 'Lungo e soddisfacente' }
};
const K_GAME = 'bp.takuzu.game', K_SET = 'bp.takuzu.settings';
const stats = BP.Stats('bp.takuzu.stats', LEVELS);
let settings = Object.assign({ showErrors: true }, store.get(K_SET, {}));
let G = store.get(K_GAME, null);
let cursor = -1, paused = false;

BP.header('Takuzu');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Risolutore: propagazione + ricerca ============ */
// celle: -1 vuota, 0 blu, 1 arancio
function lineIdx(n, k, isRow) { const a = []; for (let j = 0; j < n; j++) a.push(isRow ? k * n + j : j * n + k); return a; }
function propagate(g, n) {
  const half = n / 2;
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < n; k++) for (const isRow of [true, false]) {
      const idx = lineIdx(n, k, isRow);
      const v = idx.map(i => g[i]);
      // tre uguali di fila = contraddizione
      for (let j = 0; j + 2 < n; j++) if (v[j] >= 0 && v[j] === v[j + 1] && v[j] === v[j + 2]) return false;
      const c0 = v.filter(x => x === 0).length, c1 = v.filter(x => x === 1).length;
      if (c0 > half || c1 > half) return false;
      const set = (j, val) => { if (v[j] === -1) { v[j] = val; g[idx[j]] = val; changed = true; } };
      for (let j = 0; j < n; j++) {
        if (v[j] !== -1) continue;
        if (j >= 2 && v[j - 1] >= 0 && v[j - 1] === v[j - 2]) set(j, 1 - v[j - 1]);
        else if (j + 2 < n && v[j + 1] >= 0 && v[j + 1] === v[j + 2]) set(j, 1 - v[j + 1]);
        else if (j >= 1 && j + 1 < n && v[j - 1] >= 0 && v[j - 1] === v[j + 1]) set(j, 1 - v[j - 1]);
      }
      const d0 = v.filter(x => x === 0).length, d1 = v.filter(x => x === 1).length;
      if (d0 === half && d1 < half) for (let j = 0; j < n; j++) set(j, 1);
      else if (d1 === half && d0 < half) for (let j = 0; j < n; j++) set(j, 0);
    }
  }
  // righe/colonne complete tutte diverse
  for (const isRow of [true, false]) {
    const seen = new Set();
    for (let k = 0; k < n; k++) {
      const v = lineIdx(n, k, isRow).map(i => g[i]);
      if (v.includes(-1)) continue;
      const key = v.join('');
      if (seen.has(key)) return false;
      seen.add(key);
    }
  }
  return true;
}
function search(grid, n, limit, randomize) {
  let count = 0, first = null;
  const rec = g => {
    if (!propagate(g, n)) return false;
    const i = g.indexOf(-1);
    if (i < 0) { count++; if (!first) first = g.slice(); return count >= limit; }
    const order = randomize && Math.random() < 0.5 ? [1, 0] : [0, 1];
    for (const val of order) {
      const h = g.slice(); h[i] = val;
      if (rec(h)) return true;
    }
    return false;
  };
  rec(grid.slice());
  return { count, solution: first };
}
function generate(level) {
  const n = LEVELS[level].size;
  const sol = search(new Array(n * n).fill(-1), n, 1, true).solution;
  const puzzle = sol.slice();
  // 1) toglie le caselle che restano deducibili con le sole regole (veloce, e il puzzle resta "logico")
  const solvesByLogic = p => { const g = p.slice(); return propagate(g, n) && !g.includes(-1); };
  for (const i of shuffle([...Array(n * n).keys()])) {
    const v = puzzle[i];
    puzzle[i] = -1;
    if (!solvesByLogic(puzzle)) puzzle[i] = v;
  }
  // 2) nei livelli alti prova a togliere altro, con un limite di tempo per non bloccare il telefono
  const budget = { facile: 0, medio: 0, difficile: 250, esperto: 350 }[level];
  const t0 = performance.now();
  for (const i of shuffle([...Array(n * n).keys()])) {
    if (performance.now() - t0 > budget) break;
    if (puzzle[i] === -1) continue;
    const v = puzzle[i];
    puzzle[i] = -1;
    if (search(puzzle, n, 2, false).count !== 1) puzzle[i] = v;
  }
  return { n, sol, puzzle };
}

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  BP.loading('Mescolo i colori...');
  setTimeout(() => {
    const p = generate(level);
    G = { level, n: p.n, sol: p.sol, puzzle: p.puzzle, values: p.puzzle.slice(), hints: 0, elapsed: 0, done: false, history: [] };
    stats.played(level);
    cursor = -1; paused = false;
    save(); BP.closeSheet(); build(); render();
  }, 30);
}

/* ============ DOM ============ */
const board = $('board');
let cells = [];
function build() {
  const n = G.n;
  board.classList.remove('won');
  board.style.gridTemplateColumns = `repeat(${n},1fr)`;
  board.style.setProperty('--gap', n <= 6 ? '8px' : n <= 8 ? '6px' : '4px');
  board.innerHTML = ''; cells = [];
  for (let i = 0; i < n * n; i++) {
    const el = document.createElement('button');
    el.className = 'cell';
    el.setAttribute('aria-label', `Riga ${Math.floor(i / n) + 1}, colonna ${i % n + 1}`);
    el.addEventListener('pointerdown', e => { e.preventDefault(); tap(i); });
    board.appendChild(el); cells.push(el);
  }
}
function violations() {
  const n = G.n, bad = new Set(), half = n / 2, v = G.values;
  for (let k = 0; k < n; k++) for (const isRow of [true, false]) {
    const idx = lineIdx(n, k, isRow);
    for (let j = 0; j + 2 < n; j++) {
      const [a, b, c] = [v[idx[j]], v[idx[j + 1]], v[idx[j + 2]]];
      if (a >= 0 && a === b && b === c) [idx[j], idx[j + 1], idx[j + 2]].forEach(i => bad.add(i));
    }
    for (const col of [0, 1]) if (idx.filter(i => v[i] === col).length > half) idx.forEach(i => { if (v[i] === col) bad.add(i); });
  }
  for (const isRow of [true, false]) {
    const map = new Map();
    for (let k = 0; k < n; k++) {
      const idx = lineIdx(n, k, isRow), key = idx.map(i => v[i]).join(',');
      if (key.includes('-1')) continue;
      if (map.has(key)) { idx.forEach(i => bad.add(i)); map.get(key).forEach(i => bad.add(i)); }
      else map.set(key, idx);
    }
  }
  return bad;
}
function render() {
  if (!G) return;
  const bad = settings.showErrors ? violations() : new Set();
  cells.forEach((el, i) => {
    el.classList.toggle('v0', G.values[i] === 0);
    el.classList.toggle('v1', G.values[i] === 1);
    el.classList.toggle('given', G.puzzle[i] !== -1);
    el.classList.toggle('bad', bad.has(i));
    el.style.outline = i === cursor && !G.done ? '2px solid var(--ink)' : '';
    el.style.outlineOffset = '2px';
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('hints').textContent = G.hints;
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('stage').classList.toggle('paused', paused && !G.done);
  BP.setPauseIcon($('pauseIcon'), paused);
}

/* ============ Azioni ============ */
function setVal(i, val) {
  if (!G || G.done || paused || G.puzzle[i] !== -1) return;
  if (G.values[i] === val) return;
  G.history.push(G.values.slice()); if (G.history.length > 200) G.history.shift();
  G.values[i] = val;
  BP.sfx('tap');
  after();
}
function tap(i) {
  if (!G || G.done || paused) return;
  cursor = i;
  if (G.puzzle[i] !== -1) { render(); return; }
  const v = G.values[i];
  setVal(i, v === -1 ? 0 : v === 0 ? 1 : -1);
  render();
}
function after() {
  if (G.values.every((v, i) => v === G.sol[i])) {
    G.done = true; cursor = -1;
    const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
    board.classList.add('won');
    cells.forEach((el, i) => el.style.animationDelay = ((Math.floor(i / G.n) + i % G.n) * 30) + 'ms');
    setTimeout(() => BP.sheet(`
      <h2>Perfetto!</h2>
      <p class="sub">Takuzu ${LEVELS[G.level].label}${!record && G.hints ? ' - con aiuti il tempo non vale come record' : ''}</p>
      ${record ? '<span class="record">Nuovo record</span>' : ''}
      <div class="stats-grid">
        <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
        <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
        <div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div>
      </div>
      <button class="primary" data-act="new">Nuova partita</button>
      <button class="ghost" data-act="close">Guarda la griglia</button>`), 800);
  }
  save(); render();
}
function undo() { if (!G || G.done || !G.history.length) return; G.values = G.history.pop(); save(); render(); }
function hint() {
  if (!G || G.done || paused) return;
  // prima corregge un errore, poi rivela la casella più deducibile
  let t = G.values.findIndex((v, i) => v !== -1 && v !== G.sol[i]);
  if (t < 0) {
    const g = G.values.slice();
    propagate(g, G.n);
    t = g.findIndex((v, i) => v !== -1 && G.values[i] === -1);
    if (t < 0) t = G.values.indexOf(-1);
  }
  if (t < 0) return;
  G.history.push(G.values.slice());
  G.values[t] = G.sol[t]; G.hints++; cursor = t;
  cells[t].classList.remove('hintc'); void cells[t].offsetWidth; cells[t].classList.add('hintc');
  after();
}
function restart() {
  if (!G || !confirm('Ricominciare questa griglia da capo?')) return;
  G.values = G.puzzle.slice(); G.history = []; G.elapsed = 0; G.hints = 0; G.done = false;
  save(); build(); render();
}
function togglePause(force) { if (!G || G.done) return; paused = typeof force === 'boolean' ? force : !paused; render(); }

$('btnUndo').onclick = undo;
$('btnHint').onclick = hint;
$('btnRestart').onclick = restart;
$('btnPause').onclick = () => togglePause();
$('pauseOverlay').onclick = () => togglePause(false);
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats,
  '<div class="section-title">Impostazioni</div>' +
  BP.switchRow('showErrors', 'Mostra errori', 'Evidenzia le caselle che violano una regola', settings.showErrors));
$('btnHelp').onclick = () => BP.sheet(`
  <h2>Come si gioca</h2>
  <ul class="rules">
    <li>Colora tutte le caselle di <b>blu</b> o <b>arancio</b>. Tocca una casella per cambiarne il colore.</li>
    <li>Mai tre caselle dello stesso colore di fila, né in orizzontale né in verticale.</li>
    <li>Ogni riga e ogni colonna ha lo stesso numero di blu e di arancio.</li>
    <li>Non possono esserci due righe identiche, né due colonne identiche.</li>
    <li>Le caselle con il puntino bianco sono fisse.</li>
  </ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d, t) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); $('btnStats').onclick(); }
  else if (act === 'toggle') {
    settings[d.key] = !settings[d.key]; store.set(K_SET, settings);
    t.querySelector('.switch').classList.toggle('on', settings[d.key]); render();
  }
});
document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G || G.done) return;
  const n = G.n;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) {
    e.preventDefault();
    cursor = cursor < 0 ? 0 : ((Math.floor(cursor / n) + mv[0] + n) % n) * n + (cursor % n + mv[1] + n) % n;
    render(); return;
  }
  if (cursor < 0) return;
  if (e.key === '1') setVal(cursor, 0);
  else if (e.key === '2') setVal(cursor, 1);
  else if (['Backspace', 'Delete', '0'].includes(e.key)) setVal(cursor, -1);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(cursor); }
  render();
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const validSave = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size && [g.sol, g.puzzle, g.values].every(a => Array.isArray(a) && a.length === g.n * g.n);
try {
  if (!validSave(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.elapsed = +G.elapsed || 0; build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate, search };
})();
