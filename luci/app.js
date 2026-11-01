(() => {
'use strict';
const { $, store, fmt, icons } = BP;
const LEVELS = {
  facile:    { label: '4x4', size: 4, dots: 1, desc: 'Per prendere la mano' },
  medio:     { label: '5x5', size: 5, dots: 2, desc: 'Il classico' },
  difficile: { label: '6x6', size: 6, dots: 3, desc: 'Più luci, più pensiero' },
  esperto:   { label: '7x7', size: 7, dots: 4, desc: 'Per chi ama i rompicapi' }
};
const K_GAME = 'bp.luci.game';
const stats = BP.Stats('bp.luci.stats', LEVELS);
let G = null, cursor = -1, paused = false;

BP.header('Lights Out');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Matematica: sistema lineare modulo 2 ============ */
const area = (n, i) => {
  const r = Math.floor(i / n), c = i % n, out = [i];
  if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1);
  return out;
};
// Restituisce la soluzione con il minor numero di tocchi (array 0/1), o null se impossibile.
function solve(n, lights) {
  const m = n * n;
  const rows = [];
  for (let j = 0; j < m; j++) {
    const row = new Uint8Array(m + 1);
    for (const i of area(n, j)) row[i] = 1;
    row[m] = lights[j] ? 1 : 0;
    rows.push(row);
  }
  const pivotCol = [];
  let r = 0;
  for (let c = 0; c < m && r < m; c++) {
    let p = r; while (p < m && !rows[p][c]) p++;
    if (p === m) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let k = 0; k < m; k++) if (k !== r && rows[k][c]) for (let x = c; x <= m; x++) rows[k][x] ^= rows[r][x];
    pivotCol.push(c); r++;
  }
  for (let k = r; k < m; k++) if (rows[k][m]) return null;
  const isPivot = new Set(pivotCol);
  const free = []; for (let c = 0; c < m; c++) if (!isPivot.has(c)) free.push(c);
  let bestSol = null, bestW = Infinity;
  for (let mask = 0; mask < (1 << free.length); mask++) {
    const x = new Uint8Array(m);
    free.forEach((c, k) => { x[c] = (mask >> k) & 1; });
    pivotCol.forEach((c, k) => {
      let v = rows[k][m];
      for (const f of free) if (rows[k][f] && x[f]) v ^= 1;
      x[c] = v;
    });
    const w = x.reduce((a, b) => a + b, 0);
    if (w < bestW) { bestW = w; bestSol = x; }
  }
  return bestSol;
}
function generate(level) {
  const n = LEVELS[level].size;
  for (;;) {
    const lights = new Array(n * n).fill(0);
    for (let i = 0; i < n * n; i++) if (Math.random() < 0.5) for (const k of area(n, i)) lights[k] ^= 1;
    if (!lights.some(Boolean)) continue;
    const sol = solve(n, lights);
    const min = sol.reduce((a, b) => a + b, 0);
    if (min >= Math.min(3 + n, n * n / 3)) return { n, lights, min };
  }
}

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const p = generate(level);
  G = { level, n: p.n, start: p.lights.slice(), lights: p.lights, min: p.min, moves: 0, hints: 0, elapsed: 0, done: false, history: [] };
  stats.played(level);
  cursor = -1; paused = false;
  save(); BP.closeSheet(); build(); render();
}

/* ============ Disegno ============ */
const board = $('board');
let cells = [], hintCell = -1;
function build() {
  const n = G.n;
  board.classList.remove('won');
  board.style.gridTemplateColumns = `repeat(${n},1fr)`;
  board.style.setProperty('--gap', n <= 5 ? '10px' : '7px');
  board.innerHTML = ''; cells = [];
  for (let i = 0; i < n * n; i++) {
    const el = document.createElement('button');
    el.className = 'l';
    el.setAttribute('aria-label', `Luce ${Math.floor(i / n) + 1}, ${i % n + 1}`);
    el.addEventListener('pointerdown', e => { e.preventDefault(); press(i); });
    board.appendChild(el); cells.push(el);
  }
}
function render() {
  if (!G) return;
  cells.forEach((el, i) => {
    el.classList.toggle('on', !!G.lights[i]);
    el.classList.toggle('hint', i === hintCell);
    el.style.outline = i === cursor && !G.done ? '2px solid var(--ink)' : '';
    el.style.outlineOffset = '2px';
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('moves').textContent = G.moves;
  $('min').textContent = G.min;
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('stage').classList.toggle('paused', paused && !G.done);
  BP.setPauseIcon($('pauseIcon'), paused);
}

/* ============ Azioni ============ */
function press(i, record = true) {
  if (!G || G.done || paused) return;
  if (record) { G.history.push(i); if (G.history.length > 500) G.history.shift(); G.moves++; }
  for (const k of area(G.n, i)) G.lights[k] ^= 1;
  BP.sfx('tap');
  cursor = i; hintCell = -1;
  if (!G.lights.some(Boolean)) win();
  save(); render();
}
function win() {
  G.done = true; cursor = -1;
  const perfect = G.moves <= G.min;
  const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
  board.classList.add('won');
  cells.forEach((el, i) => el.style.animationDelay = ((Math.floor(i / G.n) + i % G.n) * 40) + 'ms');
  setTimeout(() => BP.sheet(`
    <h2>${perfect ? 'Perfetto!' : 'Tutto spento!'}</h2>
    <p class="sub">${perfect ? 'Con il numero minimo di mosse.' : `Il minimo era ${G.min} mosse, tu ne hai fatte ${G.moves}.`}</p>
    ${record ? '<span class="record">Nuovo record di tempo</span>' : ''}
    <div class="stats-grid">
      <div class="stat"><b>${G.moves}</b><span>Mosse</span></div>
      <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
      <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
    </div>
    <button class="primary" data-act="new">Nuova partita</button>
    <button class="ghost" data-act="close">Chiudi</button>`), 700);
}
function undo() {
  if (!G || G.done || paused || !G.history.length) return;
  const i = G.history.pop();
  for (const k of area(G.n, i)) G.lights[k] ^= 1;
  G.moves++; hintCell = -1;
  save(); render();
}
function hint() {
  if (!G || G.done || paused) return;
  const sol = solve(G.n, G.lights);
  if (!sol) return;
  hintCell = sol.indexOf(1);
  G.hints++;
  save(); render();
}
function restart() {
  if (!G || !confirm('Ricominciare questa griglia da capo?')) return;
  G.lights = G.start.slice(); G.moves = 0; G.history = []; G.elapsed = 0; G.hints = 0; G.done = false; hintCell = -1;
  save(); build(); render();
}
function togglePause(force) { if (!G || G.done) return; paused = typeof force === 'boolean' ? force : !paused; render(); }

$('btnUndo').onclick = undo;
$('btnHint').onclick = hint;
$('btnRestart').onclick = restart;
$('btnPause').onclick = () => togglePause();
$('pauseOverlay').onclick = () => togglePause(false);
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Toccando una luce cambi lei e le quattro vicine (sopra, sotto, destra, sinistra): accese diventano spente e viceversa.</li>
  <li>Obiettivo: spegnere tutte le luci.</li>
  <li>"Minimo" è il numero più piccolo di tocchi possibile: farcela in quel numero è una partita perfetta.</li>
  <li>Toccare due volte la stessa luce annulla l'effetto, quindi l'ordine dei tocchi non conta.</li></ul>
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
  if (e.key.toLowerCase() === 'h') { hint(); return; }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) { e.preventDefault(); cursor = cursor < 0 ? 0 : ((Math.floor(cursor / n) + mv[0] + n) % n) * n + (cursor % n + mv[1] + n) % n; render(); return; }
  if ((e.key === ' ' || e.key === 'Enter') && cursor >= 0) { e.preventDefault(); press(cursor); }
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const valid = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size &&
  [g.lights, g.start].every(a => Array.isArray(a) && a.length === g.n * g.n && a.every(v => v === 0 || v === 1)) && Number.isInteger(g.min);
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.history = G.history.filter(i => Number.isInteger(i) && i >= 0 && i < G.n * G.n);
  G.moves = Number.isFinite(G.moves) ? G.moves : 0; G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, solve, press };
})();
