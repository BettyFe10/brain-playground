(() => {
'use strict';
const { $, store, fmt, icons, shuffle, randInt } = BP;
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
const LEVELS = {
  facile:    { label: '5x5', size: 5, dots: 1, desc: 'Per imparare le regole' },
  medio:     { label: '6x6', size: 6, dots: 2, desc: 'Qualche deduzione in più' },
  difficile: { label: '7x7', size: 7, dots: 3, desc: 'Zone dalle forme strane' },
  esperto:   { label: '8x8', size: 8, dots: 4, desc: 'Serve guardare lontano' }
};
const K_GAME = 'bp.stelle.game', K_SET = 'bp.stelle.settings';
const stats = BP.Stats('bp.stelle.stats', LEVELS);
let settings = Object.assign({ showErrors: true, autoDots: true }, store.get(K_SET, {}));
let G = store.get(K_GAME, null);
let cursor = -1, paused = false;

BP.header('Stelle');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Generatore ============ */
function starPositions(n) {
  // una stella per riga e colonna, mai in caselle vicine (anche in diagonale)
  const res = [];
  const used = new Array(n).fill(false);
  const rec = r => {
    if (r === n) return true;
    for (const c of shuffle([...Array(n).keys()])) {
      if (used[c] || (r > 0 && Math.abs(res[r - 1] - c) < 2)) continue;
      used[c] = true; res[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  rec(0);
  return res;
}
function growRegions(n, stars) {
  const reg = new Array(n * n).fill(-1);
  const frontier = stars.map((c, r) => { reg[r * n + c] = r; return [r * n + c]; });
  let left = n * n - n;
  while (left > 0) {
    const k = randInt(n);
    const cand = [];
    for (const i of frontier[k]) {
      const r = Math.floor(i / n), c = i % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < n && nc < n && reg[nr * n + nc] < 0) cand.push(nr * n + nc);
      }
    }
    if (!cand.length) continue;
    const j = cand[randInt(cand.length)];
    reg[j] = k; frontier[k].push(j); left--;
  }
  return reg;
}
function countSolutions(n, reg, limit = 2, found = null) {
  let count = 0;
  const colUsed = new Array(n).fill(false), regUsed = new Array(n).fill(false);
  const pos = [];
  const rec = r => {
    if (r === n) { count++; if (found) found.push(pos.slice()); return count >= limit; }
    for (let c = 0; c < n; c++) {
      const g = reg[r * n + c];
      if (colUsed[c] || regUsed[g] || (r > 0 && Math.abs(pos[r - 1] - c) < 2)) continue;
      colUsed[c] = regUsed[g] = true; pos[r] = c;
      if (rec(r + 1)) return true;
      colUsed[c] = regUsed[g] = false;
    }
    return false;
  };
  rec(0);
  return count;
}
// controlla che la zona g resti tutta collegata
function connected(n, reg, g) {
  const cellsOf = []; reg.forEach((x, i) => { if (x === g) cellsOf.push(i); });
  if (!cellsOf.length) return false;
  const seen = new Set([cellsOf[0]]), stack = [cellsOf[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc, j = nr * n + nc;
      if (nr >= 0 && nc >= 0 && nr < n && nc < n && reg[j] === g && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cellsOf.length;
}
// Se esiste una seconda soluzione, sposta una sua stella "sbagliata" in una zona vicina per eliminarla.
function repair(n, reg, stars) {
  const starSet = new Set(stars.map((c, r) => r * n + c));
  for (let step = 0; step < 300; step++) {
    const found = [];
    const cnt = countSolutions(n, reg, 2, found);
    if (cnt === 1) return true;
    const alt = found.find(p => p.some((c, r) => c !== stars[r]));
    if (!alt) return false;
    const wrong = shuffle(alt.map((c, r) => r * n + c).filter(i => !starSet.has(i)));
    let moved = false;
    for (const i of wrong) {
      const r = Math.floor(i / n), c = i % n, from = reg[i];
      const targets = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => [r + dr, c + dc])
        .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => reg[a * n + b]).filter(g => g !== from));
      for (const to of targets) {
        reg[i] = to;
        if (connected(n, reg, from)) { moved = true; break; }
        reg[i] = from;
      }
      if (moved) break;
    }
    if (!moved) return false;
  }
  return false;
}
function generate(level) {
  const n = LEVELS[level].size;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const stars = starPositions(n);
    const reg = growRegions(n, stars);
    if (repair(n, reg, stars)) {
      // rimescola i colori delle zone
      const colors = shuffle([...Array(9).keys()]).slice(0, n);
      return { n, reg, sol: stars.map((c, r) => r * n + c), colors };
    }
  }
  return null;
}

/* ============ Stato ============ */
// valori casella: 0 vuota, 1 puntino, 2 stella
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  BP.loading('Accendo le stelle...');
  setTimeout(() => {
    const p = generate(level);
    G = { level, n: p.n, reg: p.reg, sol: p.sol, colors: p.colors, values: new Array(p.n * p.n).fill(0),
      hints: 0, elapsed: 0, done: false, history: [] };
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
  board.innerHTML = ''; cells = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const el = document.createElement('div');
    el.className = 'cell';
    el.style.background = `var(--r${G.colors[G.reg[i]]})`;
    if (c === n - 1) el.classList.add('lastC'); else if (G.reg[i + 1] !== G.reg[i]) el.classList.add('cR');
    if (r === n - 1) el.classList.add('lastR'); else if (G.reg[i + n] !== G.reg[i]) el.classList.add('cB');
    el.addEventListener('pointerdown', e => { e.preventDefault(); tap(i); });
    board.appendChild(el); cells.push(el);
  }
}
function conflicts() {
  const n = G.n, bad = new Set();
  const stars = [];
  G.values.forEach((v, i) => { if (v === 2) stars.push(i); });
  for (let a = 0; a < stars.length; a++) for (let b = a + 1; b < stars.length; b++) {
    const i = stars[a], j = stars[b];
    const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
    if (ri === rj || ci === cj || G.reg[i] === G.reg[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) { bad.add(i); bad.add(j); }
  }
  return bad;
}
function render() {
  if (!G) return;
  const bad = settings.showErrors ? conflicts() : new Set();
  cells.forEach((el, i) => {
    const v = G.values[i];
    const html = v === 2 ? STAR : v === 1 ? '<span class="dot"></span>' : '';
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    el.classList.toggle('star', v === 2);
    el.classList.toggle('bad', bad.has(i));
    el.classList.toggle('cur', i === cursor && !G.done && matchMedia('(hover:hover)').matches);
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('starCount').textContent = `${G.values.filter(v => v === 2).length}/${G.n}`;
  $('hints').textContent = G.hints;
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('stage').classList.toggle('paused', paused && !G.done);
  BP.setPauseIcon($('pauseIcon'), paused);
}

/* ============ Azioni ============ */
function neighborsOf(i) {
  const n = G.n, r = Math.floor(i / n), c = i % n, out = new Set();
  for (let k = 0; k < n; k++) { out.add(r * n + k); out.add(k * n + c); }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nc >= 0 && nr < n && nc < n) out.add(nr * n + nc);
  }
  G.reg.forEach((g, k) => { if (g === G.reg[i]) out.add(k); });
  out.delete(i);
  return out;
}
function setVal(i, v) {
  if (!G || G.done || paused || G.values[i] === v) return;
  G.history.push(G.values.slice()); if (G.history.length > 200) G.history.shift();
  G.values[i] = v;
  BP.sfx(v === 2 ? 'pop' : 'tap');
  if (v === 2 && settings.autoDots) neighborsOf(i).forEach(k => { if (G.values[k] === 0) G.values[k] = 1; });
  after();
}
function tap(i) {
  if (!G || G.done || paused) return;
  cursor = i;
  setVal(i, (G.values[i] + 1) % 3);
  render();
}
function after() {
  const stars = []; G.values.forEach((v, i) => { if (v === 2) stars.push(i); });
  if (stars.length === G.n && !conflicts().size) {
    G.done = true; cursor = -1;
    const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
    board.classList.add('won');
    setTimeout(() => BP.sheet(`
      <h2>Che cielo!</h2>
      <p class="sub">Stelle ${LEVELS[G.level].label}${!record && G.hints ? ' - con aiuti il tempo non vale come record' : ''}</p>
      ${record ? '<span class="record">Nuovo record</span>' : ''}
      <div class="stats-grid">
        <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
        <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
        <div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div>
      </div>
      <button class="primary" data-act="new">Nuova partita</button>
      <button class="ghost" data-act="close">Guarda la griglia</button>`), 900);
  }
  save(); render();
}
function undo() { if (!G || G.done || !G.history.length) return; G.values = G.history.pop(); save(); render(); }
function hint() {
  if (!G || G.done || paused) return;
  const solSet = new Set(G.sol);
  // prima toglie una stella sbagliata, poi aggiunge una stella giusta
  let t = G.values.findIndex((v, i) => v === 2 && !solSet.has(i));
  let val = 0;
  if (t < 0) { t = G.sol.find(i => G.values[i] !== 2); val = 2; }
  if (t === undefined || t < 0) return;
  G.hints++;
  cells[t].classList.remove('hintc'); void cells[t].offsetWidth; cells[t].classList.add('hintc');
  if (val === 0) { G.history.push(G.values.slice()); G.values[t] = 0; after(); }
  else setVal(t, 2);
}
function restart() {
  if (!G || !confirm('Ricominciare questa griglia da capo?')) return;
  G.values = new Array(G.n * G.n).fill(0); G.history = []; G.elapsed = 0; G.hints = 0; G.done = false;
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
  BP.switchRow('showErrors', 'Mostra errori', 'Colora in rosso le stelle in conflitto', settings.showErrors) +
  BP.switchRow('autoDots', 'Puntini automatici', 'Mettendo una stella segna le caselle dove non può andarne un\'altra', settings.autoDots));
$('btnHelp').onclick = () => BP.sheet(`
  <h2>Come si gioca</h2>
  <ul class="rules">
    <li>Metti una stella in ogni <b>riga</b>, in ogni <b>colonna</b> e in ogni <b>zona colorata</b>.</li>
    <li>Due stelle non possono toccarsi, nemmeno in diagonale.</li>
    <li>Usa i puntini per segnare dove sei sicura che non ci sia una stella.</li>
    <li>Ogni griglia ha una sola soluzione: si risolve sempre ragionando, senza tirare a indovinare.</li>
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
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { e.preventDefault(); tap(cursor); }
  else if (k === 's') setVal(cursor, 2);
  else if (k === '.') setVal(cursor, 1);
  else if (k === 'backspace' || k === 'delete') setVal(cursor, 0);
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const validSave = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size && Array.isArray(g.reg) && g.reg.length === g.n * g.n &&
  Array.isArray(g.values) && g.values.length === g.n * g.n && Array.isArray(g.sol) && g.sol.length === g.n && Array.isArray(g.colors) && g.colors.every(c => Number.isInteger(c) && c >= 0 && c < 9) && g.reg.every(Number.isInteger);
try {
  if (!validSave(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.elapsed = +G.elapsed || 0; build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate, countSolutions };
})();
