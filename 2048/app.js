(() => {
'use strict';
const { $, store, icons, randInt } = BP;
const K_GAME = 'bp.2048.game', K_BEST = 'bp.2048.best', K_STATS = 'bp.2048.stats';
const N = 4;

BP.header('2048');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Stato ============ */
// grid: 16 caselle, ognuna null oppure { id, v }
let G = null, nextId = 1, busy = false;
const num = v => Number.isFinite(v) ? v : 0;
let best = (() => { const b = store.get(K_BEST, {}) || {}; return { score: num(b.score), tile: num(b.tile) }; })();
let stats = (() => { const s = store.get(K_STATS, {}) || {}; return { played: num(s.played), reached2048: num(s.reached2048) }; })();

const isPow2 = v => Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0 && v <= 1 << 20;
function load() {
  const s = store.get(K_GAME, null);
  if (!s || !Array.isArray(s.cells) || s.cells.length !== 16 || !s.cells.every(v => v === 0 || isPow2(v))) return null;
  return {
    grid: s.cells.map(v => v ? { id: nextId++, v } : null),
    score: num(s.score), won: !!s.won, over: !!s.over, history: []
  };
}
function save() {
  if (!G) return;
  store.set(K_GAME, { cells: G.grid.map(t => t ? t.v : 0), score: G.score, won: G.won, over: G.over });
}
function spawn(grid) {
  const empty = []; grid.forEach((t, i) => { if (!t) empty.push(i); });
  if (!empty.length) return null;
  const i = empty[randInt(empty.length)];
  grid[i] = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4 };
  return i;
}
function newGame() {
  G = { grid: new Array(16).fill(null), score: 0, won: false, over: false, history: [] };
  spawn(G.grid); spawn(G.grid);
  stats.played++; store.set(K_STATS, stats);
  save(); renderAll(true);
}

/* ============ Movimento ============ */
function lines(dir) {
  const out = [];
  for (let k = 0; k < N; k++) {
    const line = [];
    for (let j = 0; j < N; j++) {
      if (dir === 'left') line.push(k * N + j);
      else if (dir === 'right') line.push(k * N + (N - 1 - j));
      else if (dir === 'up') line.push(j * N + k);
      else line.push((N - 1 - j) * N + k);
    }
    out.push(line);
  }
  return out;
}
function canMove(grid) {
  if (grid.some(t => !t)) return true;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = grid[r * N + c].v;
    if (c < N - 1 && grid[r * N + c + 1].v === v) return true;
    if (r < N - 1 && grid[(r + 1) * N + c].v === v) return true;
  }
  return false;
}
function move(dir) {
  if (!G || G.over || busy || BP.sheetOpen()) return;
  const old = G.grid;
  const grid = new Array(16).fill(null);
  const slides = [], merges = [];
  let gained = 0, moved = false;
  for (const line of lines(dir)) {
    const tiles = line.map(i => old[i] ? { t: old[i], from: i } : null).filter(Boolean);
    let pos = 0;
    for (let k = 0; k < tiles.length; k++) {
      const a = tiles[k], b = tiles[k + 1];
      const to = line[pos];
      if (b && b.t.v === a.t.v) {
        const merged = { id: nextId++, v: a.t.v * 2 };
        grid[to] = merged;
        slides.push({ id: a.t.id, to }, { id: b.t.id, to });
        merges.push({ dying: [a.t.id, b.t.id], tile: merged, at: to });
        gained += merged.v;
        moved = true;
        k++;
      } else {
        grid[to] = a.t;
        slides.push({ id: a.t.id, to });
        if (to !== a.from) moved = true;
      }
      pos++;
    }
  }
  if (!moved) return;
  G.history.push({ cells: old.map(t => t ? t.v : 0), score: G.score });
  if (G.history.length > 20) G.history.shift();
  G.grid = grid;
  G.score += gained;
  const spawnAt = spawn(grid);
  busy = true;
  for (const s of slides) place(tileEls.get(s.id), s.to);
  setTimeout(() => {
    for (const m of merges) {
      m.dying.forEach(id => { const el = tileEls.get(id); if (el) el.remove(); tileEls.delete(id); });
      addTile(m.tile, m.at, 'pop');
    }
    if (spawnAt !== null) addTile(grid[spawnAt], spawnAt, 'appear');
    busy = false;
    afterMove();
  }, 115);
}
function afterMove() {
  const maxTile = Math.max(...G.grid.map(t => t ? t.v : 0));
  if (G.score > best.score) best.score = G.score;
  if (maxTile > best.tile) best.tile = maxTile;
  store.set(K_BEST, best);
  updateScores();
  if (!G.won && maxTile >= 2048) {
    G.won = true; stats.reached2048++; store.set(K_STATS, stats);
    BP.sheet(`<h2>2048!</h2><p class="sub">Ce l'hai fatta. Vuoi continuare per un punteggio ancora più alto?</p>
      <button class="primary" data-act="close">Continua</button><button class="ghost" data-act="new">Nuova partita</button>`);
  }
  if (!canMove(G.grid)) {
    G.over = true;
    setTimeout(() => BP.sheet(`<h2>Fine partita</h2>
      <div class="stats-grid"><div class="stat"><b>${G.score}</b><span>Punti</span></div><div class="stat"><b>${maxTile}</b><span>Tessera max</span></div><div class="stat"><b>${best.score}</b><span>Record</span></div></div>
      <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="undoLast">Annulla l'ultima mossa</button>`), 300);
  }
  save();
  $('btnUndo').disabled = !G.history.length;
}
function undo() {
  if (!G || busy || !G.history.length) return;
  const h = G.history.pop();
  G.grid = h.cells.map(v => v ? { id: nextId++, v } : null);
  G.score = h.score; G.over = false;
  save(); renderAll(false);
}

/* ============ Disegno ============ */
const tilesBox = $('tiles');
const tileEls = new Map();
function cssPos(i) {
  const r = Math.floor(i / N), c = i % N;
  return `translate(calc(${c} * (100% + var(--g))), calc(${r} * (100% + var(--g))))`;
}
function place(el, i) { if (!el) return; const p = cssPos(i); el.style.setProperty('--pos', p); el.style.transform = p; }
function fontFor(v) {
  const w = tilesBox.clientWidth / N || 80;
  const digits = String(v).length;
  return Math.round(w * (digits <= 2 ? .45 : digits === 3 ? .38 : digits === 4 ? .3 : .24)) + 'px';
}
function addTile(t, i, anim) {
  const el = document.createElement('div');
  el.className = `t ${t.v <= 2048 ? 'v' + t.v : 'vbig'}${anim ? ' ' + anim : ''}`;
  el.textContent = t.v;
  el.style.setProperty('--fs', fontFor(t.v));
  place(el, i);
  tilesBox.appendChild(el);
  tileEls.set(t.id, el);
}
function renderAll(animateNew) {
  tilesBox.innerHTML = ''; tileEls.clear();
  G.grid.forEach((t, i) => { if (t) addTile(t, i, animateNew ? 'appear' : ''); });
  updateScores();
  $('btnUndo').disabled = !G.history.length;
}
function updateScores() { $('score').textContent = G ? G.score : 0; $('best').textContent = best.score; }
window.addEventListener('resize', () => { if (G) renderAll(false); });

/* ============ Controlli: un movimento per gesto ============ */
const board = $('board');
let sx = 0, sy = 0, tracking = false;
board.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true; }, { passive: true });
board.addEventListener('touchmove', e => { if (tracking) e.preventDefault(); }, { passive: false });
board.addEventListener('touchend', e => {
  if (!tracking) return; tracking = false;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
// trascinamento con il mouse sul desktop
board.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { sx = e.clientX; sy = e.clientY; board.dataset.drag = '1'; } });
window.addEventListener('pointerup', e => {
  if (e.pointerType !== 'mouse' || !board.dataset.drag) return;
  board.dataset.drag = '';
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
document.addEventListener('keydown', e => {
  if (BP.sheetOpen()) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const d = map[e.key] || map[e.key.toLowerCase()];
  if (d) { e.preventDefault(); move(d); }
});
$('btnUndo').onclick = undo;
$('btnRestart').onclick = () => { if (!G || G.over || confirm('Ricominciare da capo?')) newGame(); };
$('btnNew').onclick = () => { if (!G || G.over || confirm('Iniziare una nuova partita?')) newGame(); };
$('btnStats').onclick = () => BP.sheet(`<h2>Record</h2>
  <div class="stats-grid"><div class="stat"><b>${best.score}</b><span>Miglior punteggio</span></div><div class="stat"><b>${best.tile}</b><span>Tessera più alta</span></div><div class="stat"><b>${stats.played}</b><span>Partite</span></div></div>
  <p class="sub">2048 raggiunto ${stats.reached2048} ${stats.reached2048 === 1 ? 'volta' : 'volte'}.</p>
  <button class="danger" data-act="resetStats">Azzera record</button><button class="primary" data-act="close">Chiudi</button>`);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Scorri su, giù, a destra o a sinistra: tutte le tessere scivolano in quella direzione.</li>
  <li>Due tessere con lo stesso numero che si scontrano diventano una sola, con la somma.</li>
  <li>A ogni mossa compare una nuova tessera da 2 o 4.</li>
  <li>Obiettivo: arrivare alla tessera 2048. Poi puoi continuare.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet(act => {
  if (act === 'new') { BP.closeSheet(); newGame(); }
  else if (act === 'undoLast') { BP.closeSheet(); undo(); }
  else if (act === 'resetStats' && confirm('Azzerare i record?')) {
    best = { score: 0, tile: 0 }; stats = { played: 0, reached2048: 0 };
    store.set(K_BEST, best); store.set(K_STATS, stats); BP.closeSheet(); updateScores();
  }
});

G = load();
if (G) renderAll(false); else newGame();
BP.registerSW();
window.__game = { get state() { return G; }, move, canMove };
})();
