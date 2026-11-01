(() => {
'use strict';
const { $, store, fmt, randInt, shuffle } = BP;
const LEVELS = {
  facile:    { label: 'Facile',    w: 9,  h: 9,  mines: 10, dots: 1, desc: '9x9, 10 mine' },
  medio:     { label: 'Medio',     w: 10, h: 13, mines: 22, dots: 2, desc: '10x13, 22 mine' },
  difficile: { label: 'Difficile', w: 12, h: 16, mines: 38, dots: 3, desc: '12x16, 38 mine' }
};
const K_GAME = 'bp.campominato.game';
const stats = BP.Stats('bp.campominato.stats', LEVELS);
const FLAG = '<svg viewBox="0 0 24 24"><path d="M6 21V3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 3.5h10.5l-2.5 4 2.5 4H7z" fill="#e2725b"/></svg>';
const MINE = '<svg viewBox="0 0 24 24"><circle cx="11" cy="13" r="7" fill="#2a2440"/><circle cx="8.5" cy="10.5" r="2" fill="#fff" opacity=".6"/><path d="M15 8l2.5-2.5" stroke="#2a2440" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="4.5" r="1.8" fill="#f2b705"/></svg>';
let G = null, mode = 'dig', cursor = -1;

BP.header('Campo minato');

/* ============ Geometria ============ */
const nbrs = (w, h, i) => {
  const r = Math.floor(i / w), c = i % w, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nc >= 0 && nr < h && nc < w) out.push(nr * w + nc);
  }
  return out;
};

/* ============ Risolutore logico: verifica che non serva tirare a indovinare ============ */
function logicSolvable(w, h, mine, start) {
  const n = w * h;
  const counts = Array.from({ length: n }, (_, i) => nbrs(w, h, i).filter(k => mine[k]).length);
  const open = new Uint8Array(n), flag = new Uint8Array(n);
  const reveal = i => {
    const st = [i];
    while (st.length) {
      const k = st.pop();
      if (open[k]) continue;
      if (mine[k]) return false;
      open[k] = 1;
      if (counts[k] === 0) for (const x of nbrs(w, h, k)) if (!open[x]) st.push(x);
    }
    return true;
  };
  reveal(start);
  const totalSafe = n - mine.reduce((a, b) => a + b, 0);
  for (let guard = 0; guard < 500; guard++) {
    let progress = false;
    const cons = [];
    for (let i = 0; i < n; i++) {
      if (!open[i] || !counts[i]) continue;
      const unk = [], ns = nbrs(w, h, i);
      let f = 0;
      for (const k of ns) { if (flag[k]) f++; else if (!open[k]) unk.push(k); }
      if (!unk.length) continue;
      const need = counts[i] - f;
      if (need === 0) { unk.forEach(k => reveal(k)); progress = true; }
      else if (need === unk.length) { unk.forEach(k => { flag[k] = 1; }); progress = true; }
      else cons.push({ unk, need });
    }
    if (!progress) {
      // regola dei sottoinsiemi tra coppie di numeri vicini
      outer: for (const a of cons) for (const b of cons) {
        if (a === b || a.unk.length >= b.unk.length) continue;
        if (!a.unk.every(k => b.unk.includes(k))) continue;
        const diff = b.unk.filter(k => !a.unk.includes(k)), need = b.need - a.need;
        if (need === 0) { diff.forEach(k => { if (!open[k]) reveal(k); }); progress = true; break outer; }
        if (need === diff.length) { diff.forEach(k => { flag[k] = 1; }); progress = true; break outer; }
      }
    }
    if (!progress) break;
  }
  return open.reduce((a, b) => a + b, 0) === totalSafe;
}
function generate(level, start) {
  const L = LEVELS[level], n = L.w * L.h;
  const forbidden = new Set([start, ...nbrs(L.w, L.h, start)]);
  const cand = [...Array(n).keys()].filter(i => !forbidden.has(i));
  let mine = null;
  const t0 = performance.now();
  for (let attempt = 0; attempt < 3000 && performance.now() - t0 < 2500; attempt++) {
    const m = new Array(n).fill(0);
    shuffle(cand).slice(0, L.mines).forEach(i => { m[i] = 1; });
    mine = m;
    if (logicSolvable(L.w, L.h, m, start)) return { mine, guaranteed: true };
  }
  return { mine, guaranteed: false };
}

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const L = LEVELS[level];
  G = { level, w: L.w, h: L.h, mines: L.mines, mine: null, open: new Array(L.w * L.h).fill(0), flag: new Array(L.w * L.h).fill(0),
    elapsed: 0, started: false, done: false, lost: false, boom: -1 };
  cursor = -1;
  save(); BP.closeSheet(); build(); render();
}
const countAt = i => nbrs(G.w, G.h, i).filter(k => G.mine[k]).length;

/* ============ Disegno ============ */
const field = $('field');
let cells = [];
function build() {
  field.classList.remove('won');
  field.style.gridTemplateColumns = `repeat(${G.w}, minmax(0,1fr))`;
  field.innerHTML = ''; cells = [];
  for (let i = 0; i < G.w * G.h; i++) {
    const el = document.createElement('div');
    el.className = 'm';
    el.setAttribute('role', 'button');
    attach(el, i);
    field.appendChild(el); cells.push(el);
  }
  resize();
}
function resize() {
  if (!G) return;
  const wide = matchMedia('(min-width:880px) and (min-height:560px)').matches;
  const avail = wide ? window.innerHeight - 160 : window.innerHeight * 0.7;
  const maxW = Math.min($('stage').clientWidth || innerWidth - 32, (avail / G.h) * G.w);
  field.style.width = Math.floor(maxW) + 'px';
  field.style.margin = '0 auto';
  field.style.setProperty('--fs', Math.max(12, Math.floor(maxW / G.w * .52)) + 'px');
}
window.addEventListener('resize', resize);
function render() {
  if (!G) return;
  cells.forEach((el, i) => {
    let html = '', cls = 'm';
    if (G.open[i]) {
      cls += ' open';
      if (G.mine && G.mine[i]) { html = MINE; if (i === G.boom) cls += ' boom'; }
      else { const c = countAt(i); if (c) { html = String(c); cls += ` n n${c}`; } }
    } else if (G.flag[i]) {
      html = FLAG;
      if (G.lost && G.mine && !G.mine[i]) cls += ' wrongflag';
    } else if ((G.lost || G.done) && G.mine && G.mine[i]) {
      html = G.lost ? MINE : FLAG; cls += ' mine-hidden';
    }
    if (i === cursor && !G.done) cls += ' cur';
    if (el.className !== cls) el.className = cls;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('left').textContent = G.mines - G.flag.reduce((a, b) => a + b, 0);
  $('timer').textContent = fmt(G.elapsed);
  BP.setPauseIcon($('pauseIcon'), false);
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
}

/* ============ Azioni ============ */
function dig(i) {
  if (!G || G.done) return;
  if (!G.started) {
    const { mine, guaranteed } = generate(G.level, i);
    G.mine = mine; G.started = true;
    stats.played(G.level);
    if (!guaranteed) BP.toast('Questa griglia potrebbe richiedere un tentativo');
  }
  if (G.flag[i]) return;
  if (G.open[i]) { chord(i); return; }
  if (G.mine[i]) return lose(i);
  const st = [i];
  while (st.length) {
    const k = st.pop();
    if (G.open[k] || G.flag[k]) continue;
    G.open[k] = 1;
    if (countAt(k) === 0) for (const x of nbrs(G.w, G.h, k)) if (!G.open[x]) st.push(x);
  }
  checkWin(); save(); render();
}
function chord(i) {
  const c = countAt(i);
  if (!c) return;
  const ns = nbrs(G.w, G.h, i);
  if (ns.filter(k => G.flag[k]).length !== c) return;
  for (const k of ns) if (!G.open[k] && !G.flag[k]) { if (G.mine[k]) return lose(k); }
  for (const k of ns) if (!G.open[k] && !G.flag[k]) dig(k);
}
function toggleFlag(i) {
  if (!G || G.done || G.open[i]) return;
  G.flag[i] = G.flag[i] ? 0 : 1;
  BP.fx('flag', 15);
  save(); render();
}
function lose(i) {
  G.done = true; G.lost = true; G.boom = i; G.open[i] = 1;
  BP.fx('boom', [60, 40, 120]);
  save(); render();
  setTimeout(() => BP.sheet(`<h2>Boom!</h2><p class="sub">Ogni griglia si può risolvere con la logica: c'era un indizio da qualche parte. Riprova!</p>
    <div class="stats-grid"><div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div><div class="stat"><b>${G.open.reduce((a, b) => a + b, 0) - 1}</b><span>Caselle aperte</span></div><div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div></div>
    <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="close">Guarda il campo</button>`), 600);
}
function checkWin() {
  const safe = G.w * G.h - G.mines;
  if (G.open.reduce((a, b) => a + b, 0) !== safe) return;
  G.done = true;
  G.mine.forEach((m, k) => { if (m) G.flag[k] = 1; });
  const record = stats.won(G.level, G.elapsed);
  field.classList.add('won');
  setTimeout(() => BP.sheet(`<h2>Campo ripulito!</h2><p class="sub">${LEVELS[G.level].desc}</p>
    ${record ? '<span class="record">Nuovo record</span>' : ''}
    <div class="stats-grid"><div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div><div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div><div class="stat"><b>${stats.data[G.level].best !== null ? fmt(stats.data[G.level].best) : '-'}</b><span>Record</span></div></div>
    <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="close">Chiudi</button>`), 500);
}

/* ============ Input: tocco, pressione lunga, clic destro ============ */
function attach(el, i) {
  let timer = null, longDone = false;
  el.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    longDone = false;
    clearTimeout(timer);
    timer = setTimeout(() => { longDone = true; toggleFlag(i); }, 420);
  });
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerup', e => {
    clearTimeout(timer);
    if (e.button === 2 || longDone) return;
    cursor = i;
    if (mode === 'flag' && !G.open[i]) toggleFlag(i); else dig(i);
  });
  el.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(i); });
}
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => { mode = b.dataset.mode; render(); });
document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G || G.done) return;
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (mv) { e.preventDefault(); cursor = cursor < 0 ? 0 : ((Math.floor(cursor / G.w) + mv[0] + G.h) % G.h) * G.w + (cursor % G.w + mv[1] + G.w) % G.w; render(); return; }
  if (cursor < 0) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); dig(cursor); }
  if (e.key.toLowerCase() === 'f') toggleFlag(cursor);
});
$('btnPause').onclick = () => {};
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && G.started && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Apri tutte le caselle senza mine. Il primo tocco non è mai una mina.</li>
  <li>Il numero indica quante mine ci sono nelle 8 caselle intorno.</li>
  <li>Segna le mine con la bandierina: tieni premuto, oppure usa la modalità Bandierina.</li>
  <li>Tocca un numero che ha già tutte le sue bandierine per aprire in un colpo le caselle intorno.</li>
  <li>Ogni griglia è verificata: si risolve sempre ragionando, senza tirare a indovinare.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});
BP.ticker(() => {
  if (!G || G.done || !G.started) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const bin = (a, len) => Array.isArray(a) && a.length === len && a.every(v => v === 0 || v === 1);
const valid = g => g && LEVELS[g.level] && g.w === LEVELS[g.level].w && g.h === LEVELS[g.level].h && g.mines === LEVELS[g.level].mines &&
  bin(g.open, g.w * g.h) && bin(g.flag, g.w * g.h) && (g.mine === null ? !g.started : bin(g.mine, g.w * g.h));
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, generate, logicSolvable, dig, toggleFlag };
})();
