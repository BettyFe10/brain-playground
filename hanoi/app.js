(() => {
'use strict';
const { $, store, fmt, icons } = BP;
const LEVELS = {
  facile:    { label: '4 dischi', disks: 4, dots: 1, desc: 'Minimo 15 mosse' },
  medio:     { label: '5 dischi', disks: 5, dots: 2, desc: 'Minimo 31 mosse' },
  difficile: { label: '6 dischi', disks: 6, dots: 3, desc: 'Minimo 63 mosse' },
  esperto:   { label: '7 dischi', disks: 7, dots: 4, desc: 'Minimo 127 mosse' }
};
const COLORS = ['#e2725b', '#f2a65a', '#f2c94c', '#7cc08a', '#5fb3c9', '#6a8fe0', '#b07ad8'];
const K_GAME = 'bp.hanoi.game';
const stats = BP.Stats('bp.hanoi.stats', LEVELS);
let G = null, pick = -1, paused = false, hintMove = null;

BP.header('Hanoi');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Stato: pegs = tre pile, dal basso verso l'alto (1 = disco più piccolo) ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const n = LEVELS[level].disks;
  G = { level, n, pegs: [Array.from({ length: n }, (_, k) => n - k), [], []], moves: 0, hints: 0, elapsed: 0, done: false, history: [] };
  stats.played(level);
  pick = -1; paused = false; hintMove = null;
  save(); BP.closeSheet(); render();
}
const minMoves = n => 2 ** n - 1;

// Prossima mossa ottimale da qualunque posizione verso il paletto di destra.
function nextBest(pegs, n) {
  const where = new Array(n + 1);
  pegs.forEach((p, k) => p.forEach(d => { where[d] = k; }));
  const rec = (disk, target) => {
    if (disk === 0) return null;
    if (where[disk] === target) return rec(disk - 1, target);
    const other = 3 - where[disk] - target;
    return rec(disk - 1, other) || [where[disk], target];
  };
  return rec(n, 2);
}

/* ============ Disegno ============ */
const tower = $('tower');
const pegEls = [0, 1, 2].map(k => {
  const el = document.createElement('div');
  el.className = 'peg';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Paletto ${k + 1}`);
  el.addEventListener('pointerdown', e => { e.preventDefault(); tapPeg(k); });
  tower.appendChild(el);
  return el;
});
function render() {
  if (!G) return;
  const h = tower.clientHeight || 300, w = tower.clientWidth / 3 || 120;
  const dh = Math.min(30, (h * 0.78) / G.n - 3);
  pegEls.forEach((el, k) => {
    el.innerHTML = '';
    G.pegs[k].forEach((d, idx) => {
      const disk = document.createElement('div');
      disk.className = 'disk';
      disk.style.setProperty('--dh', dh + 'px');
      disk.style.width = (28 + (d / G.n) * (w * 0.88 - 28)) + 'px';
      disk.style.background = COLORS[(d - 1) % COLORS.length];
      if (k === pick && idx === G.pegs[k].length - 1) disk.classList.add('lift');
      el.appendChild(disk);
    });
    el.classList.toggle('src', k === pick);
    el.classList.toggle('target', k === 2);
    el.classList.toggle('hintp', !!hintMove && (hintMove[0] === k && pick < 0 || hintMove[1] === k && pick === hintMove[0]));
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('moves').textContent = G.moves;
  $('min').textContent = minMoves(G.n);
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  BP.setPauseIcon($('pauseIcon'), paused);
  tower.style.opacity = paused && !G.done ? '.35' : '';
}
window.addEventListener('resize', render);

/* ============ Azioni ============ */
function tapPeg(k) {
  if (!G || G.done) return;
  if (paused) { paused = false; render(); return; }
  if (pick < 0) {
    if (!G.pegs[k].length) return;
    pick = k; render(); return;
  }
  if (k === pick) { pick = -1; render(); return; }
  const from = G.pegs[pick], to = G.pegs[k];
  const disk = from[from.length - 1];
  if (to.length && to[to.length - 1] < disk) {
    BP.toast('Non si può mettere un disco grande su uno piccolo');
    BP.vibrate(50);
    pick = -1; render(); return;
  }
  to.push(from.pop());
  G.history.push([pick, k]); if (G.history.length > 600) G.history.shift();
  G.moves++; pick = -1; hintMove = null;
  if (G.pegs[2].length === G.n) win();
  save(); render();
}
function win() {
  G.done = true;
  const perfect = G.moves === minMoves(G.n);
  const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
  setTimeout(() => BP.sheet(`
    <h2>${perfect ? 'Perfetto!' : 'Torre spostata!'}</h2>
    <p class="sub">${perfect ? 'Nel numero minimo di mosse: complimenti.' : `Il minimo era ${minMoves(G.n)} mosse, tu ne hai fatte ${G.moves}.`}</p>
    ${record ? '<span class="record">Nuovo record di tempo</span>' : ''}
    <div class="stats-grid">
      <div class="stat"><b>${G.moves}</b><span>Mosse</span></div>
      <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
      <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
    </div>
    <button class="primary" data-act="new">Nuova partita</button>
    <button class="ghost" data-act="close">Chiudi</button>`), 400);
}
function undo() {
  if (!G || G.done || !G.history.length) return;
  const [a, b] = G.history.pop();
  G.pegs[a].push(G.pegs[b].pop());
  G.moves++; pick = -1; hintMove = null;
  save(); render();
}
function hint() {
  if (!G || G.done) return;
  hintMove = nextBest(G.pegs, G.n);
  pick = -1; G.hints++;
  save(); render();
}
function restart() {
  if (!G || !confirm('Ricominciare da capo?')) return;
  const lv = G.level; newGame(lv);
}

$('btnUndo').onclick = undo;
$('btnHint').onclick = hint;
$('btnRestart').onclick = restart;
$('btnPause').onclick = () => { if (G && !G.done) { paused = !paused; render(); } };
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Sposta tutti i dischi sul paletto di <b>destra</b>.</li>
  <li>Tocca un paletto per prendere il disco in cima, poi tocca il paletto dove metterlo.</li>
  <li>Si sposta un disco alla volta, e mai un disco più grande sopra uno più piccolo.</li>
  <li>Il minimo di mosse è 2 alla potenza del numero di dischi, meno 1.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});
document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key.toLowerCase() === 'h') { hint(); return; }
  if (['1', '2', '3'].includes(e.key)) tapPeg(+e.key - 1);
  if (e.key === 'Escape') { pick = -1; render(); }
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const valid = g => {
  if (!g || !LEVELS[g.level] || g.n !== LEVELS[g.level].disks || !Array.isArray(g.pegs) || g.pegs.length !== 3) return false;
  const all = g.pegs.flat();
  if (all.length !== g.n || new Set(all).size !== g.n || !all.every(d => Number.isInteger(d) && d >= 1 && d <= g.n)) return false;
  return g.pegs.every(p => p.every((d, k) => k === 0 || p[k - 1] > d));
};
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  G.history = Array.isArray(G.history) ? G.history.filter(m => Array.isArray(m) && m.length === 2 && m.every(x => x >= 0 && x <= 2)) : [];
  G.moves = Number.isFinite(G.moves) ? G.moves : 0; G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, nextBest, tapPeg };
})();
