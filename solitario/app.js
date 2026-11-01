(() => {
'use strict';
const { $, store, fmt, icons, shuffle } = BP;
const LEVELS = {
  uno: { label: 'Pesca 1', draw: 1, dots: 1, desc: 'Si gira una carta alla volta: più rilassante' },
  tre: { label: 'Pesca 3', draw: 3, dots: 3, desc: 'Si girano tre carte: la versione classica' }
};
const K_GAME = 'bp.solitario.game';
const stats = BP.Stats('bp.solitario.stats', LEVELS);
const SUIT = [
  '<path d="M12 2C9 6 4 9 4 13a4 4 0 0 0 7 2.6L10 21h4l-1-5.4A4 4 0 0 0 20 13c0-4-5-7-8-11z"/>',
  '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>',
  '<path d="M12 2l7 10-7 10-7-10z"/>',
  '<circle cx="12" cy="7.5" r="4"/><circle cx="7" cy="13.5" r="4"/><circle cx="17" cy="13.5" r="4"/><path d="M11 13h2l1.5 8h-5z"/>'
];
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suitOf = c => Math.floor(c / 13), rankOf = c => c % 13 + 1, isRed = c => suitOf(c) === 1 || suitOf(c) === 2;
let G = null, paused = false, autoTimer = null;

BP.header('Solitario');
$('btnUndo').innerHTML = icons.undo + 'Annulla';
$('btnHint').innerHTML = icons.hint + 'Aiuto';
$('btnAuto').innerHTML = icons.check + 'Completa';

/* ============ Stato ============ */
const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const deck = shuffle([...Array(52).keys()]);
  const tab = [];
  for (let k = 0; k < 7; k++) {
    tab.push(deck.splice(0, k + 1).map((c, j) => ({ c, up: j === k })));
  }
  G = { level, draw: LEVELS[level].draw, stock: deck, waste: [], found: [[], [], [], []], tab, moves: 0, elapsed: 0, done: false, history: [] };
  stats.played(level);
  paused = false; stopAuto();
  save(); BP.closeSheet(); render();
}
const snapshot = () => JSON.stringify({ stock: G.stock, waste: G.waste, found: G.found, tab: G.tab, moves: G.moves });
function pushHistory() { G.history.push(snapshot()); if (G.history.length > 150) G.history.shift(); }

/* ============ Regole ============ */
const canFound = c => { const f = G.found[suitOf(c)]; return rankOf(c) === f.length + 1; };
const canTab = (c, col) => {
  const t = G.tab[col];
  if (!t.length) return rankOf(c) === 13;
  const top = t[t.length - 1];
  return top.up && rankOf(top.c) === rankOf(c) + 1 && isRed(top.c) !== isRed(c);
};
function flipTops() { for (const t of G.tab) if (t.length && !t[t.length - 1].up) t[t.length - 1].up = true; }
function afterMove() {
  G.moves++;
  BP.sfx('tap');
  flipTops();
  if (G.found.every(f => f.length === 13)) win();
  save(); render();
}

/* ============ Mosse automatiche al tocco ============ */
function drawStock() {
  if (!G || G.done || paused) return;
  pushHistory();
  if (G.stock.length) {
    for (let k = 0; k < G.draw && G.stock.length; k++) G.waste.push(G.stock.pop());
  } else if (G.waste.length) {
    G.stock = G.waste.reverse(); G.waste = [];
  } else { G.history.pop(); return; }
  afterMove();
}
function tapWaste() {
  if (!G.waste.length) return;
  const c = G.waste[G.waste.length - 1];
  if (canFound(c)) { pushHistory(); G.found[suitOf(c)].push(G.waste.pop()); return afterMove(); }
  for (let col = 0; col < 7; col++) if (canTab(c, col)) { pushHistory(); G.tab[col].push({ c: G.waste.pop(), up: true }); return afterMove(); }
  nope('waste');
}
function tapTab(col, idx) {
  const t = G.tab[col];
  if (!t[idx] || !t[idx].up) return;
  const seq = t.slice(idx);
  const first = seq[0].c;
  if (seq.length === 1 && canFound(first)) { pushHistory(); G.found[suitOf(first)].push(t.pop().c); return afterMove(); }
  // cerca la colonna successiva valida: toccando ancora si passa alla prossima opzione
  for (let s = 1; s <= 7; s++) {
    const dst = (col + s) % 7;
    if (dst === col || !canTab(first, dst)) continue;
    if (!G.tab[dst].length && idx === 0) continue; // spostare un re da una colonna vuota a un'altra non serve
    pushHistory();
    G.tab[dst].push(...t.splice(idx));
    return afterMove();
  }
  nope(`tab:${col}:${idx}`);
}
function tapFound(s) {
  const f = G.found[s];
  if (!f.length) return;
  const c = f[f.length - 1];
  for (let col = 0; col < 7; col++) if (canTab(c, col)) { pushHistory(); G.tab[col].push({ c: f.pop(), up: true }); return afterMove(); }
  nope(`found:${s}`);
}
function nope(key) {
  BP.fx('error', 30);
  const el = table.querySelector(`[data-k="${key}"]`);
  if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
}
function undo() {
  if (!G || G.done || !G.history.length) return;
  stopAuto();
  Object.assign(G, JSON.parse(G.history.pop()));
  save(); render();
}
function canAutoComplete() { return !G.done && !G.stock.length && !G.waste.length && G.tab.every(t => t.every(x => x.up)); }
function autoComplete() {
  if (!G || !canAutoComplete() || autoTimer) return;
  pushHistory();
  autoTimer = setInterval(() => {
    for (let col = 0; col < 7; col++) {
      const t = G.tab[col];
      if (t.length && canFound(t[t.length - 1].c)) { G.found[suitOf(t[t.length - 1].c)].push(t.pop().c); G.moves++; break; }
    }
    if (G.found.every(f => f.length === 13)) { stopAuto(); win(); }
    save(); render();
  }, 70);
}
function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
function hint() {
  if (!G || G.done) return;
  const show = key => { const el = table.querySelector(`[data-k="${key}"]`); if (el) { el.classList.add('sel'); setTimeout(() => el.classList.remove('sel'), 1100); } };
  const w = G.waste[G.waste.length - 1];
  // 1) verso le fondazioni
  if (w !== undefined && canFound(w)) return show('waste');
  for (let col = 0; col < 7; col++) { const t = G.tab[col]; if (t.length && canFound(t[t.length - 1].c)) return show(`tab:${col}:${t.length - 1}`); }
  // 2) spostamenti che scoprono una carta coperta
  for (let col = 0; col < 7; col++) {
    const t = G.tab[col], idx = t.findIndex(x => x.up);
    if (idx > 0) for (let d = 0; d < 7; d++) if (d !== col && canTab(t[idx].c, d)) return show(`tab:${col}:${idx}`);
  }
  // 3) dalla carta scoperta del mazzo al tavolo
  if (w !== undefined) for (let d = 0; d < 7; d++) if (canTab(w, d)) return show('waste');
  // 4) un re verso una colonna vuota
  for (let col = 0; col < 7; col++) {
    const t = G.tab[col], idx = t.findIndex(x => x.up);
    if (idx > 0 && rankOf(t[idx].c) === 13 && G.tab.some(x => !x.length)) return show(`tab:${col}:${idx}`);
  }
  if (G.stock.length || G.waste.length) { show('stock'); BP.toast('Gira una carta dal mazzo'); return; }
  BP.toast('Nessuna mossa utile: prova ad annullare qualche mossa');
}
function win() {
  if (G.done) return;
  G.done = true;
  const record = stats.won(G.level, G.elapsed);
  save();
  setTimeout(() => {
    table.classList.add('won');
    BP.sheet(`<h2>Solitario risolto!</h2><p class="sub">${LEVELS[G.level].label}</p>${record ? '<span class="record">Nuovo record</span>' : ''}
      <div class="stats-grid"><div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div><div class="stat"><b>${G.moves}</b><span>Mosse</span></div><div class="stat"><b>${stats.data[G.level].won}</b><span>Vinte</span></div></div>
      <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="close">Chiudi</button>`);
  }, 400);
}

/* ============ Disegno ============ */
const table = $('table');
const cardHtml = (c, up, key, style) => {
  if (!up) return `<div class="c down" data-k="${key}" style="${style}"></div>`;
  const svg = `<svg viewBox="0 0 24 24" fill="currentColor">${SUIT[suitOf(c)]}</svg>`;
  return `<div class="c${isRed(c) ? ' red' : ''}" data-k="${key}" style="${style}"><span class="tl">${RANK[rankOf(c)]}${svg}</span><svg class="big" viewBox="0 0 24 24" fill="currentColor">${SUIT[suitOf(c)]}</svg></div>`;
};
function render() {
  if (!G) return;
  const W = table.clientWidth || 360;
  const gap = Math.max(4, Math.min(12, W * 0.02));
  const cw = Math.floor((W - gap * 6) / 7), ch = cw * 1.4;
  table.style.setProperty('--cw', cw + 'px');
  const wide = matchMedia('(min-width:880px) and (min-height:560px)').matches;
  const availH = (wide ? innerHeight - 140 : innerHeight - table.getBoundingClientRect().top - 150) - ch - 12;
  // riga in alto: mazzo, scarti, spazio, 4 fondazioni
  const stockHtml = G.stock.length ? cardHtml(0, false, 'stock', 'top:0') : `<div class="slot" data-k="stock">${icons.restart}</div>`;
  const shown = G.waste.slice(-Math.min(G.draw, 3));
  const wasteHtml = shown.map((c, k) => cardHtml(c, true, k === shown.length - 1 ? 'waste' : 'wasteUnder', `top:0;left:${k * cw * 0.28}px;${k < shown.length - 1 ? 'pointer-events:none' : ''}`)).join('');
  const foundHtml = G.found.map((f, s) => `<div class="pile">${f.length ? cardHtml(f[f.length - 1], true, `found:${s}`, 'top:0') : `<div class="slot"><svg viewBox="0 0 24 24" fill="currentColor">${SUIT[s]}</svg></div>`}</div>`).join('');
  let html = `<div class="row"><div class="pile">${stockHtml}</div><div class="pile">${wasteHtml}</div><div></div>${foundHtml}</div><div class="row">`;
  G.tab.forEach((t, col) => {
    const downN = t.filter(x => !x.up).length, upN = t.length - downN;
    let dOff = ch * 0.16, uOff = ch * 0.3;
    const need = downN * dOff + Math.max(0, upN - 1) * uOff + ch;
    if (need > availH && availH > ch * 2) { const k = (availH - ch) / (need - ch); dOff *= k; uOff *= k; }
    let y = 0, cards = '';
    t.forEach((x, idx) => { cards += cardHtml(x.c, x.up, `tab:${col}:${idx}`, `top:${y}px`); y += x.up ? uOff : dOff; });
    const h = t.length ? y - (t[t.length - 1].up ? uOff : dOff) + ch : ch;
    html += `<div class="pile" style="height:${h}px">${t.length ? cards : `<div class="slot" data-k="empty:${col}">K</div>`}</div>`;
  });
  html += '</div>';
  table.innerHTML = html;
  table.classList.toggle('won', G.done);
  $('lvl').textContent = LEVELS[G.level].label;
  $('moves').textContent = G.moves;
  $('timer').textContent = fmt(G.elapsed);
  $('btnUndo').disabled = !G.history.length || G.done;
  $('btnAuto').classList.toggle('show', canAutoComplete());
  BP.setPauseIcon($('pauseIcon'), paused);
  table.style.opacity = paused && !G.done ? '.3' : '';
}
window.addEventListener('resize', render);

table.addEventListener('click', e => {
  if (!G || G.done || autoTimer) return;
  if (paused) { paused = false; render(); return; }
  const el = e.target.closest('[data-k]');
  if (!el) return;
  const k = el.dataset.k;
  if (k === 'stock') drawStock();
  else if (k === 'waste') tapWaste();
  else if (k.startsWith('tab:')) { const [, col, idx] = k.split(':').map(Number); tapTab(col, idx); }
  else if (k.startsWith('found:')) tapFound(+k.split(':')[1]);
});
$('btnUndo').onclick = undo;
$('btnHint').onclick = hint;
$('btnAuto').onclick = autoComplete;
$('btnPause').onclick = () => { if (G && !G.done) { paused = !paused; render(); } };
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { title: 'Nuova partita', sub: 'Scegli come girare le carte.', canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Porta tutte le carte nelle 4 pile in alto a destra, per seme, dall'Asso al Re.</li>
  <li>Sul tavolo le carte vanno in ordine decrescente, alternando rosso e nero.</li>
  <li>In una colonna vuota può andare solo un Re.</li>
  <li><b>Tocca una carta</b> e si sposta da sola nel posto migliore; toccala ancora per provare un'altra colonna.</li>
  <li>Quando tutte le carte sono scoperte compare <b>Completa</b>.</li>
  <li>Non tutte le partite di solitario sono vincibili: se resti bloccata, Annulla è tuo amico.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS, { title: 'Nuova partita', sub: 'Scegli come girare le carte.' });
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});
document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || !G) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key === ' ') { e.preventDefault(); drawStock(); }
  if (e.key.toLowerCase() === 'h') hint();
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const valid = g => {
  if (!g || !LEVELS[g.level] || ![1, 3].includes(g.draw)) return false;
  if (!Array.isArray(g.stock) || !Array.isArray(g.waste) || !Array.isArray(g.found) || g.found.length !== 4 || !Array.isArray(g.tab) || g.tab.length !== 7) return false;
  if (!g.tab.every(t => Array.isArray(t) && t.every(x => x && Number.isInteger(x.c) && typeof x.up === 'boolean'))) return false;
  const all = [...g.stock, ...g.waste, ...g.found.flat(), ...g.tab.flat().map(x => x.c)];
  return all.length === 52 && new Set(all).size === 52 && all.every(c => Number.isInteger(c) && c >= 0 && c < 52);
};
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  if (!Array.isArray(G.history)) G.history = [];
  G.history = G.history.filter(h => typeof h === 'string');
  G.moves = Number.isFinite(G.moves) ? G.moves : 0; G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS, { title: 'Nuova partita', sub: 'Scegli come girare le carte.' }); }
BP.registerSW();
window.__game = { get state() { return G; }, drawStock, tapWaste, tapTab, tapFound, autoComplete, canAutoComplete };
})();
