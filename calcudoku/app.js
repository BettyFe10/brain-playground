(() => {
'use strict';
const { $, store, fmt, icons, shuffle, randInt } = BP;
const LEVELS = {
  facile:    { label: '4x4', size: 4, dots: 1, desc: 'Per capire il gioco' },
  medio:     { label: '5x5', size: 5, dots: 2, desc: 'Somme, differenze, prodotti, divisioni' },
  difficile: { label: '6x6', size: 6, dots: 3, desc: 'Gabbie più grandi' },
  esperto:   { label: '7x7', size: 7, dots: 4, desc: 'Per veri appassionati' }
};
const K_GAME = 'bp.calcudoku.game', K_SET = 'bp.calcudoku.settings';
const stats = BP.Stats('bp.calcudoku.stats', LEVELS);
let settings = Object.assign({ showErrors: true, autoNotes: true }, store.get(K_SET, {}));
let G = store.get(K_GAME, null);
let sel = -1, notesMode = false, paused = false, lastPlaced = -1;

BP.header('Calcudoku');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnErase').innerHTML = icons.erase + 'Cancella';
$('btnNotes').innerHTML = icons.notes + 'Note <span class="badge" id="notesBadge">OFF</span>';
$('btnHint').innerHTML = icons.hint + 'Aiuto';

/* ============ Generatore ============ */
function latinSquare(n) {
  const perm = shuffle([...Array(n).keys()]).map(x => x + 1);
  const rows = shuffle([...Array(n).keys()]), cols = shuffle([...Array(n).keys()]);
  const g = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g.push(perm[(rows[r] + cols[c]) % n]);
  return g;
}
function makeCages(n) {
  const cageOf = new Array(n * n).fill(-1);
  const cages = [];
  const order = shuffle([...Array(n * n).keys()]);
  const maxSize = n <= 4 ? 3 : 4;
  for (const start of order) {
    if (cageOf[start] >= 0) continue;
    const r = Math.random();
    const target = r < 0.08 ? 1 : r < 0.5 ? 2 : r < 0.85 ? 3 : maxSize;
    const cells = [start];
    cageOf[start] = cages.length;
    while (cells.length < target) {
      const options = [];
      for (const c of cells) {
        const cr = Math.floor(c / n), cc = c % n;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = cr + dr, nc = cc + dc;
          if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
          const k = nr * n + nc;
          if (cageOf[k] < 0) options.push(k);
        }
      }
      if (!options.length) break;
      const k = options[randInt(options.length)];
      cageOf[k] = cages.length; cells.push(k);
    }
    cages.push({ cells: cells.sort((a, b) => a - b) });
  }
  return { cages, cageOf };
}
function assignOps(cages, sol) {
  for (const cage of cages) {
    const vals = cage.cells.map(i => sol[i]);
    if (vals.length === 1) { cage.op = ''; cage.target = vals[0]; continue; }
    if (vals.length === 2) {
      const [a, b] = [Math.max(...vals), Math.min(...vals)];
      const opts = ['+', '×', '-', '-'];
      if (a % b === 0) opts.push('÷', '÷', '÷');
      cage.op = opts[randInt(opts.length)];
    } else {
      cage.op = Math.random() < 0.5 ? '+' : '×';
      if (cage.op === '×' && vals.reduce((x, y) => x * y, 1) > 999) cage.op = '+';
    }
    if (cage.op === '+') cage.target = vals.reduce((x, y) => x + y, 0);
    else if (cage.op === '×') cage.target = vals.reduce((x, y) => x * y, 1);
    else if (cage.op === '-') cage.target = Math.max(...vals) - Math.min(...vals);
    else cage.target = Math.max(...vals) / Math.min(...vals);
  }
}
const cageMatch = (op, target, vals) => {
  if (op === '') return vals[0] === target;
  if (op === '+') return vals.reduce((x, y) => x + y, 0) === target;
  if (op === '×') return vals.reduce((x, y) => x * y, 1) === target;
  const a = Math.max(...vals), b = Math.min(...vals);
  return op === '-' ? a - b === target : a === b * target;
};
// Conta le soluzioni (fino a limit) scegliendo sempre la gabbia con meno combinazioni possibili.
function countSolutions(n, cages, limit = 2) {
  const tuples = cages.map(cage => {
    const out = [], k = cage.cells.length, cur = new Array(k);
    const rec = d => {
      if (d === k) {
        if (cageMatch(cage.op, cage.target, cur)) out.push(cur.slice());
        return;
      }
      const ri = Math.floor(cage.cells[d] / n), ci = cage.cells[d] % n;
      for (let v = 1; v <= n; v++) {
        let ok = true;
        for (let e = 0; e < d; e++) {
          const rj = Math.floor(cage.cells[e] / n), cj = cage.cells[e] % n;
          if (cur[e] === v && (rj === ri || cj === ci)) { ok = false; break; }
        }
        if (!ok) continue;
        cur[d] = v; rec(d + 1);
      }
    };
    rec(0);
    return out;
  });
  const rowM = new Int32Array(n), colM = new Int32Array(n);
  const used = new Array(cages.length).fill(false);
  let count = 0;
  const fitsT = (ci, t) => cages[ci].cells.every((cell, k) => !((rowM[Math.floor(cell / n)] | colM[cell % n]) & (1 << t[k])));
  const rec = () => {
    let best = -1, bestList = null;
    for (let ci = 0; ci < cages.length; ci++) {
      if (used[ci]) continue;
      const list = [];
      for (const t of tuples[ci]) if (fitsT(ci, t)) { list.push(t); if (bestList && list.length >= bestList.length) break; }
      if (!bestList || list.length < bestList.length) { best = ci; bestList = list; if (!list.length) return false; }
    }
    if (best < 0) { count++; return count >= limit; }
    used[best] = true;
    for (const t of bestList) {
      cages[best].cells.forEach((cell, k) => { rowM[Math.floor(cell / n)] |= 1 << t[k]; colM[cell % n] |= 1 << t[k]; });
      if (rec()) return true;
      cages[best].cells.forEach((cell, k) => { rowM[Math.floor(cell / n)] &= ~(1 << t[k]); colM[cell % n] &= ~(1 << t[k]); });
    }
    used[best] = false;
    return false;
  };
  rec();
  return count;
}
function generate(level) {
  const n = LEVELS[level].size;
  for (let attempt = 0; attempt < 500; attempt++) {
    const sol = latinSquare(n);
    const { cages, cageOf } = makeCages(n);
    assignOps(cages, sol);
    if (countSolutions(n, cages, 2) === 1) return { n, sol, cages, cageOf };
  }
  return null;
}

/* ============ Stato e salvataggio ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  BP.loading('Preparo le gabbie...');
  setTimeout(() => {
    const p = generate(level);
    G = { level, n: p.n, sol: p.sol, cages: p.cages, cageOf: p.cageOf,
      values: new Array(p.n * p.n).fill(0), notes: new Array(p.n * p.n).fill(0),
      errors: 0, hints: 0, elapsed: 0, done: false, history: [] };
    stats.played(level);
    sel = -1; notesMode = false; paused = false;
    save(); BP.closeSheet(); build(); render();
  }, 30);
}

/* ============ DOM ============ */
const board = $('board'), pad = $('pad');
let cells = [], padBtns = [];
function build() {
  const n = G.n;
  board.classList.remove('won');
  board.style.gridTemplateColumns = `repeat(${n},1fr)`;
  board.style.setProperty('--fs', `clamp(18px, ${44 / n}vw, ${200 / n}px)`);
  board.style.setProperty('--os', `clamp(9px, ${13 / n}vw, ${64 / n}px)`);
  board.style.setProperty('--ns', `clamp(8px, ${11 / n}vw, ${52 / n}px)`);
  board.innerHTML = ''; cells = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n;
    const el = document.createElement('div');
    el.className = 'cell';
    if (c === n - 1) el.classList.add('lastC'); else if (G.cageOf[i + 1] !== G.cageOf[i]) el.classList.add('cR');
    if (r === n - 1) el.classList.add('lastR'); else if (G.cageOf[i + n] !== G.cageOf[i]) el.classList.add('cB');
    el.addEventListener('pointerdown', e => { e.preventDefault(); select(i); });
    board.appendChild(el); cells.push(el);
  }
  pad.style.setProperty('--pn', n);
  pad.innerHTML = ''; padBtns = [];
  for (let d = 1; d <= n; d++) {
    const b = document.createElement('button');
    b.className = 'num'; b.innerHTML = `${d}<small></small>`;
    b.onclick = () => input(d);
    pad.appendChild(b); padBtns.push(b);
  }
}
function cageStatus(ci) {
  const cage = G.cages[ci];
  const vals = cage.cells.map(i => G.values[i]);
  if (vals.some(v => !v)) return 0;
  return cageMatch(cage.op, cage.target, vals) ? 1 : -1;
}
function render() {
  if (!G) return;
  const n = G.n, selVal = sel >= 0 ? G.values[sel] : 0;
  const selR = sel >= 0 ? Math.floor(sel / n) : -1, selC = sel >= 0 ? sel % n : -1;
  const selCage = sel >= 0 ? G.cageOf[sel] : -1;
  for (let i = 0; i < n * n; i++) {
    const el = cells[i], v = G.values[i];
    const r = Math.floor(i / n), c = i % n;
    const cage = G.cages[G.cageOf[i]];
    const isFirst = cage.cells[0] === i;
    const st = cageStatus(G.cageOf[i]);
    el.classList.toggle('sel', i === sel);
    el.classList.toggle('peer', sel >= 0 && i !== sel && (r === selR || c === selC));
    el.classList.toggle('cage', sel >= 0 && i !== sel && G.cageOf[i] === selCage);
    el.classList.toggle('same', !!selVal && i !== sel && v === selVal);
    el.classList.toggle('err', settings.showErrors && !!v && v !== G.sol[i]);
    el.classList.toggle('cageBad', settings.showErrors && st === -1);
    el.classList.toggle('cageOk', st === 1);
    el.classList.toggle('pop', i === lastPlaced);
    let html = isFirst ? `<span class="op">${cage.target}${cage.op}</span>` : '';
    if (v) html += v;
    else if (G.notes[i]) {
      html += '<div class="notes">';
      for (let d = 1; d <= n; d++) html += `<i>${G.notes[i] & (1 << d) ? d : ''}</i>`;
      html += '</div>';
    }
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
  }
  lastPlaced = -1;
  const counts = new Array(n + 1).fill(0);
  G.values.forEach(v => { if (v) counts[v]++; });
  padBtns.forEach((b, k) => {
    const left = n - counts[k + 1];
    b.classList.toggle('done', left <= 0);
    b.querySelector('small').textContent = left > 0 ? left : '';
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('errs').textContent = G.errors;
  $('hints').textContent = G.hints;
  $('errWrap').style.visibility = settings.showErrors ? 'visible' : 'hidden';
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('btnNotes').classList.toggle('on', notesMode);
  $('notesBadge').textContent = notesMode ? 'ON' : 'OFF';
  $('app').classList.toggle('notes-on', notesMode);
  $('stage').classList.toggle('paused', paused && !G.done);
  BP.setPauseIcon($('pauseIcon'), paused);
}

/* ============ Azioni ============ */
function select(i) { if (!G || paused) return; sel = i; render(); }
function pushHistory() { G.history.push([G.values.slice(), G.notes.slice()]); if (G.history.length > 150) G.history.shift(); }
function clearPeerNotes(i, d) {
  const n = G.n, r = Math.floor(i / n), c = i % n;
  for (let k = 0; k < n; k++) { G.notes[r * n + k] &= ~(1 << d); G.notes[k * n + c] &= ~(1 << d); }
}
function input(d) {
  if (!G || G.done || paused) return;
  if (sel < 0) { BP.toast('Seleziona prima una casella'); return; }
  const i = sel;
  if (notesMode) {
    if (G.values[i]) return;
    pushHistory(); G.notes[i] ^= (1 << d);
  } else {
    pushHistory();
    if (G.values[i] === d) G.values[i] = 0;
    else {
      G.values[i] = d; G.notes[i] = 0; lastPlaced = i;
      if (d !== G.sol[i]) { G.errors++; BP.fx('error', 60); } else BP.sfx('tap');
      if (settings.autoNotes) clearPeerNotes(i, d);
    }
  }
  after();
}
function erase() {
  if (!G || G.done || paused || sel < 0) return;
  if (!G.values[sel] && !G.notes[sel]) return;
  pushHistory(); G.values[sel] = 0; G.notes[sel] = 0; after();
}
function undo() {
  if (!G || G.done || paused || !G.history.length) return;
  [G.values, G.notes] = G.history.pop(); after();
}
function hint() {
  if (!G || G.done || paused) return;
  const need = i => G.values[i] !== G.sol[i];
  let t = sel >= 0 && need(sel) ? sel : -1;
  if (t < 0) {
    // privilegia le gabbie quasi complete
    let best = 99;
    G.values.forEach((v, i) => {
      if (!need(i)) return;
      const missing = G.cages[G.cageOf[i]].cells.filter(k => !G.values[k]).length;
      if (missing < best) { best = missing; t = i; }
    });
  }
  if (t < 0) return;
  pushHistory();
  G.values[t] = G.sol[t]; G.notes[t] = 0; clearPeerNotes(t, G.sol[t]);
  G.hints++; sel = t; lastPlaced = t; after();
}
function after() {
  if (G.values.every((v, i) => v === G.sol[i])) win();
  render(); save();
}
function win() {
  if (G.done) return;
  G.done = true; sel = -1;
  const record = stats.won(G.level, G.elapsed, { countsForRecord: !G.hints });
  board.classList.add('won');
  cells.forEach((el, i) => el.style.animationDelay = ((Math.floor(i / G.n) + i % G.n) * 45) + 'ms');
  setTimeout(() => BP.sheet(`
    <h2>Risolto!</h2>
    <p class="sub">Calcudoku ${LEVELS[G.level].label}${!record && G.hints ? ' - con aiuti il tempo non vale come record' : ''}</p>
    ${record ? '<span class="record">Nuovo record</span>' : ''}
    <div class="stats-grid">
      <div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div>
      <div class="stat"><b>${G.errors}</b><span>Errori</span></div>
      <div class="stat"><b>${G.hints}</b><span>Aiuti</span></div>
    </div>
    <button class="primary" data-act="new">Nuova partita</button>
    <button class="ghost" data-act="close">Guarda la griglia</button>`), 900);
}
const toggleNotes = () => { notesMode = !notesMode; render(); };
function togglePause(force) { if (!G || G.done) return; paused = typeof force === 'boolean' ? force : !paused; render(); }

$('btnUndo').onclick = undo;
$('btnErase').onclick = erase;
$('btnNotes').onclick = toggleNotes;
$('btnHint').onclick = hint;
$('btnPause').onclick = () => togglePause();
$('pauseOverlay').onclick = () => togglePause(false);
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats,
  '<div class="section-title">Impostazioni</div>' +
  BP.switchRow('showErrors', 'Mostra errori', 'Colora in rosso numeri e gabbie sbagliati', settings.showErrors) +
  BP.switchRow('autoNotes', 'Note automatiche', 'Inserendo un numero lo toglie dalle note di riga e colonna', settings.autoNotes));
$('btnHelp').onclick = () => BP.sheet(`
  <h2>Come si gioca</h2>
  <ul class="rules">
    <li>Ogni riga e ogni colonna contiene i numeri da 1 alla misura della griglia, senza ripetizioni.</li>
    <li>Le zone con il bordo spesso sono <b>gabbie</b>: il numero in alto a sinistra è il risultato dell'operazione sui numeri della gabbia.</li>
    <li>Per <b>-</b> e <b>÷</b> (gabbie da due) l'ordine non conta: 3- può essere 5 e 2 oppure 2 e 5.</li>
    <li>Dentro una gabbia un numero può ripetersi, purché non sia nella stessa riga o colonna.</li>
    <li>Quando una gabbia è giusta, il suo numero diventa verde.</li>
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
  if (BP.sheetOpen() || !G) return;
  const n = G.n;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (/^[1-9]$/.test(e.key) && +e.key <= n) { input(+e.key); return; }
  if (['Backspace', 'Delete', '0'].includes(e.key)) { erase(); return; }
  if (e.key.toLowerCase() === 'n') { toggleNotes(); return; }
  if (e.key.toLowerCase() === 'h') { hint(); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) {
    e.preventDefault();
    if (sel < 0) { select(0); return; }
    select(((Math.floor(sel / n) + mv[0] + n) % n) * n + (sel % n + mv[1] + n) % n);
  }
});

BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const validSave = g => g && LEVELS[g.level] && g.n === LEVELS[g.level].size && Array.isArray(g.sol) && g.sol.length === g.n * g.n &&
  Array.isArray(g.values) && g.values.length === g.n * g.n && Array.isArray(g.notes) && Array.isArray(g.cages) && Array.isArray(g.cageOf) &&
  g.cageOf.every(c => g.cages[c] && Array.isArray(g.cages[c].cells)) &&
  g.cages.every(c => ['', '+', '-', '×', '÷'].includes(c.op) && Number.isInteger(c.target) && c.cells.every(Number.isInteger));
try {
  if (!validSave(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.elapsed = +G.elapsed || 0; build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate, countSolutions };
})();
