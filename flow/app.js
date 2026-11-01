(() => {
'use strict';
const { $, store, fmt, icons, randInt } = BP;
const LEVELS = {
  facile:    { label: '5x5', size: 5, dots: 1, desc: 'Pochi colori, tubi corti' },
  medio:     { label: '6x6', size: 6, dots: 2, desc: 'Un po\' più di intreccio' },
  difficile: { label: '7x7', size: 7, dots: 3, desc: 'Tubi lunghi e tortuosi' },
  esperto:   { label: '9x9', size: 9, dots: 4, desc: 'Tanti colori da far passare' }
};
const COLORS = ['#e2725b', '#5b8de2', '#58b37a', '#f2b705', '#b07ad8', '#f28cb1', '#2ab3b0', '#f2894c', '#8a6c4f', '#9bbd3e', '#5a5fd1', '#d14d8f'];
const K_GAME = 'bp.flow.game';
const stats = BP.Stats('bp.flow.stats', LEVELS);
let G = null, paused = false;

BP.header('Flow');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnRestart').innerHTML = icons.restart + 'Ricomincia';

/* ============ Generatore: un percorso che copre tutta la griglia, rimescolato e poi tagliato ============ */
function generate(level) {
  const n = LEVELS[level].size, N = n * n;
  // percorso a serpentina che tocca ogni casella
  let p = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) p.push(r * n + (r % 2 ? n - 1 - c : c));
  const adj = (a, b) => { const ra = Math.floor(a / n), rb = Math.floor(b / n); return (ra === rb && Math.abs(a - b) === 1) || (a % n === b % n && Math.abs(ra - rb) === 1); };
  const nb = i => { const r = Math.floor(i / n), c = i % n, o = []; if (r) o.push(i - n); if (r < n - 1) o.push(i + n); if (c) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
  // mosse "backbite": rimescolano il percorso restando sempre un percorso valido
  for (let it = 0; it < N * 40; it++) {
    if (Math.random() < 0.5) p.reverse();
    const end = p[0];
    const choices = nb(end).filter(v => v !== p[1]);
    const v = choices[randInt(choices.length)];
    const j = p.indexOf(v);
    p = p.slice(0, j).reverse().concat(p.slice(j));
  }
  // taglia il percorso in tubi lunghi almeno 3 caselle
  const maxLen = { 5: 6, 6: 7, 7: 8, 9: 10 }[n];
  const paths = [];
  let k = 0;
  while (k < N) {
    const left = N - k;
    let len = 3 + randInt(maxLen - 2);
    if (left - len < 3) len = left;
    if (paths.length === COLORS.length - 1) len = left;
    paths.push(p.slice(k, k + len));
    k += len;
  }
  // evita tubi banali: estremi dello stesso colore uno accanto all'altro
  if (paths.some(q => adj(q[0], q[q.length - 1]) && q.length <= 4)) return generate(level);
  return { n, sol: paths, ends: paths.map(q => [q[0], q[q.length - 1]]) };
}

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const p = generate(level);
  G = { level, n: p.n, ends: p.ends, sol: p.sol, paths: p.ends.map(() => []), elapsed: 0, hints: 0, done: false, history: [] };
  stats.played(level);
  paused = false;
  save(); BP.closeSheet(); render();
}
const endColor = i => G.ends.findIndex(e => e[0] === i || e[1] === i);
const owner = i => G.paths.findIndex(q => q.includes(i));
const isComplete = k => { const q = G.paths[k], e = G.ends[k]; return q.length >= 2 && ((q[0] === e[0] && q[q.length - 1] === e[1]) || (q[0] === e[1] && q[q.length - 1] === e[0])); };

/* ============ Disegno (SVG) ============ */
const svg = $('svg'), flowEl = $('flow');
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const center = i => [i % G.n + .5, Math.floor(i / G.n) + .5];
function render() {
  if (!G) return;
  const n = G.n;
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.replaceChildren();
  // caselle colorate tenuemente dove passa un tubo
  G.paths.forEach((q, k) => q.forEach(i => {
    const [x, y] = center(i);
    svg.appendChild(el('rect', { x: x - .5, y: y - .5, width: 1, height: 1, fill: COLORS[k], 'fill-opacity': isComplete(k) ? .22 : .12 }));
  }));
  for (let k = 1; k < n; k++) {
    svg.appendChild(el('line', { x1: k, y1: 0, x2: k, y2: n, class: 'gridline' }));
    svg.appendChild(el('line', { x1: 0, y1: k, x2: n, y2: k, class: 'gridline' }));
  }
  G.paths.forEach((q, k) => {
    if (q.length < 2) return;
    svg.appendChild(el('polyline', { points: q.map(i => center(i).join(',')).join(' '), fill: 'none', stroke: COLORS[k], 'stroke-width': .34, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  });
  G.ends.forEach((e, k) => e.forEach(i => {
    const [x, y] = center(i);
    svg.appendChild(el('circle', { cx: x, cy: y, r: .36, fill: COLORS[k] }));
    svg.appendChild(el('circle', { cx: x - .1, cy: y - .1, r: .09, fill: '#fff', 'fill-opacity': .55 }));
  }));
  const done = G.paths.filter((_, k) => isComplete(k)).length;
  const covered = new Set(G.paths.flat()).size;
  $('lvl').textContent = LEVELS[G.level].label;
  $('pipes').textContent = `${done}/${G.ends.length}`;
  $('fill').textContent = Math.round(covered / (n * n) * 100) + '%';
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  BP.setPauseIcon($('pauseIcon'), paused);
  flowEl.style.opacity = paused && !G.done ? '.3' : '';
}

/* ============ Disegno dei tubi con il dito ============ */
let drag = null;
function cellAt(e) {
  const r = flowEl.getBoundingClientRect();
  const c = Math.floor((e.clientX - r.left) / r.width * G.n), w = Math.floor((e.clientY - r.top) / r.height * G.n);
  if (c < 0 || w < 0 || c >= G.n || w >= G.n) return -1;
  return w * G.n + c;
}
function cutOthersAt(i, k) {
  G.paths.forEach((q, j) => {
    if (j === k) return;
    const at = q.indexOf(i);
    if (at >= 0) G.paths[j] = q.slice(0, at);
    if (G.paths[j].length === 1 && endColor(G.paths[j][0]) !== j) G.paths[j] = [];
  });
}
function stepTo(i) {
  const k = drag.color, q = G.paths[k];
  const tail = q[q.length - 1];
  if (i === tail) return;
  const back = q.indexOf(i);
  if (back >= 0) { G.paths[k] = q.slice(0, back + 1); return; }
  if (isComplete(k)) return;
  const n = G.n, tr = Math.floor(tail / n), ir = Math.floor(i / n);
  if (Math.abs(tr - ir) + Math.abs(tail % n - i % n) !== 1) return;
  const ec = endColor(i);
  if (ec >= 0 && ec !== k) return;
  cutOthersAt(i, k);
  q.push(i);
}
flowEl.addEventListener('pointerdown', e => {
  if (!G || G.done || paused) return;
  const i = cellAt(e);
  if (i < 0) return;
  e.preventDefault();
  let k = endColor(i);
  const snapshot = G.paths.map(q => q.slice());
  if (k >= 0) { cutOthersAt(i, k); G.paths[k] = [i]; }
  else {
    k = owner(i);
    if (k < 0) return;
    G.paths[k] = G.paths[k].slice(0, G.paths[k].indexOf(i) + 1);
  }
  drag = { color: k, snapshot, last: i };
  try { flowEl.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  render();
});
flowEl.addEventListener('pointermove', e => {
  if (!drag) return;
  const i = cellAt(e);
  if (i < 0 || i === drag.last) return;
  // movimenti veloci: avanza una casella alla volta (prima in orizzontale, poi in verticale)
  const n = G.n;
  let cur = G.paths[drag.color][G.paths[drag.color].length - 1];
  for (let guard = 0; guard < 2 * n && cur !== i; guard++) {
    const cr = Math.floor(cur / n), cc = cur % n, ir = Math.floor(i / n), ic = i % n;
    const nxt = cc !== ic ? cr * n + cc + Math.sign(ic - cc) : (cr + Math.sign(ir - cr)) * n + cc;
    const before = G.paths[drag.color].length;
    stepTo(nxt);
    const q = G.paths[drag.color];
    if (q.length === before && q[q.length - 1] !== nxt) break;
    cur = q[q.length - 1];
  }
  drag.last = i;
  render();
});
const endDrag = () => {
  if (!drag) return;
  const changed = JSON.stringify(drag.snapshot) !== JSON.stringify(G.paths);
  if (changed) { G.history.push(drag.snapshot); if (G.history.length > 100) G.history.shift(); }
  const wasComplete = drag.snapshot[drag.color] && isComplete(drag.color);
  drag = null;
  if (wasComplete) BP.fx('good', 12);
  checkWin(); save(); render();
};
flowEl.addEventListener('pointerup', endDrag);
flowEl.addEventListener('pointercancel', endDrag);

function checkWin() {
  const all = G.ends.every((_, k) => isComplete(k));
  if (!all) return;
  const covered = new Set(G.paths.flat()).size;
  if (covered < G.n * G.n) { BP.toast('Tutti collegati! Ora riempi anche le caselle vuote'); return; }
  G.done = true;
  const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
  flowEl.classList.remove('won'); void flowEl.offsetWidth; flowEl.classList.add('won');
  setTimeout(() => BP.sheet(`<h2>Tutto collegato!</h2><p class="sub">Flow ${LEVELS[G.level].label}${!record && G.hints ? ' - con aiuti il tempo non vale come record' : ''}</p>
    ${record ? '<span class="record">Nuovo record</span>' : ''}
    <div class="stats-grid"><div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div><div class="stat"><b>${G.hints}</b><span>Aiuti</span></div><div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div></div>
    <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="close">Chiudi</button>`), 700);
}
function undo() { if (!G || G.done || !G.history.length) return; G.paths = G.history.pop(); save(); render(); }
function hint() {
  if (!G || G.done || paused) return;
  // completa il primo tubo non ancora uguale alla soluzione
  const k = G.sol.findIndex((s, j) => JSON.stringify(s) !== JSON.stringify(G.paths[j]) && JSON.stringify(s.slice().reverse()) !== JSON.stringify(G.paths[j]));
  if (k < 0) return;
  G.history.push(G.paths.map(q => q.slice()));
  for (const i of G.sol[k]) cutOthersAt(i, k);
  G.paths[k] = G.sol[k].slice();
  G.hints++;
  checkWin(); save(); render();
}
function restart() {
  if (!G || !confirm('Cancellare tutti i tubi e ricominciare?')) return;
  G.paths = G.ends.map(() => []); G.history = []; G.elapsed = 0; G.hints = 0; G.done = false;
  save(); render();
}

$('btnUndo').onclick = undo;
$('btnHint').onclick = hint;
$('btnRestart').onclick = restart;
$('btnPause').onclick = () => { if (G && !G.done) { paused = !paused; render(); } };
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Collega ogni coppia di pallini dello stesso colore trascinando il dito.</li>
  <li>I tubi non possono incrociarsi né passare sopra un pallino di un altro colore.</li>
  <li>Per vincere tutte le caselle devono essere riempite.</li>
  <li>Puoi ripartire da metà di un tubo: toccalo e continua a trascinare.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});
document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.key.toLowerCase() === 'h') hint();
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const cellOk = (g, i) => Number.isInteger(i) && i >= 0 && i < g.n * g.n;
const valid = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size && Array.isArray(g.ends) && g.ends.length <= COLORS.length &&
  g.ends.every(e => Array.isArray(e) && e.length === 2 && e.every(i => cellOk(g, i))) &&
  Array.isArray(g.sol) && g.sol.length === g.ends.length && g.sol.every(q => Array.isArray(q) && q.every(i => cellOk(g, i))) &&
  Array.isArray(g.paths) && g.paths.length === g.ends.length && g.paths.every(q => Array.isArray(q) && q.every(i => cellOk(g, i)));
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate };
})();
