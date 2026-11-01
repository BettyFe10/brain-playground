(() => {
'use strict';
const { $, store, fmt, icons, shuffle } = BP;
const LEVELS = {
  facile:    { label: '6 coppie',  pairs: 6,  cols: 3, dots: 1, desc: '12 carte' },
  medio:     { label: '8 coppie',  pairs: 8,  cols: 4, dots: 2, desc: '16 carte' },
  difficile: { label: '10 coppie', pairs: 10, cols: 4, dots: 3, desc: '20 carte' },
  esperto:   { label: '15 coppie', pairs: 15, cols: 5, dots: 4, desc: '30 carte' }
};
// Icone originali, disegnate a mano in SVG
const ART = [
  '<path d="M12 21s-7.5-4.6-9.3-9.2C1.3 8.2 3.6 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.9 1.3-1.8 2.8-2.9 4.8-2.9 3.6 0 5.9 3.7 4.5 7.3C19.5 16.4 12 21 12 21z" fill="#e2725b"/>',
  '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" fill="#f2b705"/>',
  '<path d="M15.5 3a9 9 0 1 0 5.5 13.6A7.5 7.5 0 0 1 15.5 3z" fill="#6a8fe0"/><circle cx="16" cy="8" r="1" fill="#fff"/>',
  '<circle cx="12" cy="12" r="5" fill="#f2a65a"/><g stroke="#f2a65a" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g>',
  '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5 4.8 4.8 0 0 1 17.5 18z" fill="#9fb4e8"/><circle cx="10" cy="13" r="1" fill="#2a2440"/><circle cx="14" cy="13" r="1" fill="#2a2440"/>',
  '<path d="M5 19C5 10 10 4 20 4c0 10-6 15-15 15z" fill="#58b37a"/><path d="M5 19L15 9" stroke="#2f7a48" stroke-width="1.8" stroke-linecap="round"/>',
  '<path d="M12 2.5s6.5 7.5 6.5 12a6.5 6.5 0 0 1-13 0c0-4.5 6.5-12 6.5-12z" fill="#2ab3b0"/><path d="M9 15a3 3 0 0 0 3 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  '<g fill="#f28cb1"><circle cx="12" cy="6.5" r="3.6"/><circle cx="17.2" cy="10.4" r="3.6"/><circle cx="15.2" cy="16.4" r="3.6"/><circle cx="8.8" cy="16.4" r="3.6"/><circle cx="6.8" cy="10.4" r="3.6"/></g><circle cx="12" cy="12" r="3" fill="#f2b705"/>',
  '<path d="M3.5 12a8.5 8.5 0 0 1 17 0z" fill="#e2725b"/><circle cx="9" cy="9" r="1.4" fill="#fff"/><circle cx="14.5" cy="7.5" r="1.1" fill="#fff"/><path d="M9.5 12h5v6.5a2.5 2.5 0 0 1-5 0z" fill="#f3e7d9"/>',
  '<path d="M2.5 12c3-5 8-6 12.5-3.5L20 5v14l-5-3.5C10.5 18 5.5 17 2.5 12z" fill="#f2894c"/><circle cx="7.5" cy="11" r="1.2" fill="#2a2440"/>',
  '<path d="M12 4c1-1.5 3-2 4.5-1.5" stroke="#3f8f5a" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M8.5 9c-2.6-.6-5 1.2-5 4.6 0 4.3 3.3 7.9 6 7.9 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c2.7 0 6-3.6 6-7.9 0-3.4-2.4-5.2-5-4.6-1.5.3-2.3 1-3.5 1s-2-.7-3.5-1z" fill="#d84a4a"/>',
  '<path d="M9 18V5l11-2v13" stroke="#b07ad8" stroke-width="2.2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="3" fill="#b07ad8"/><circle cx="17.5" cy="16" r="3" fill="#b07ad8"/>',
  '<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2z" fill="#f2c94c" stroke="#d9a400" stroke-width=".8" stroke-linejoin="round"/>',
  '<path d="M6 3h12l4 6-10 12L2 9z" fill="#5fb3c9"/><path d="M2 9h20M8.5 3L6 9l6 12 6-12-2.5-6" stroke="#fff" stroke-opacity=".6" stroke-width="1" fill="none"/>',
  '<path d="M5 9l2-6 4 4h2l4-4 2 6c1 1.5 1.5 3.2 1.5 5 0 4.4-3.8 7-8.5 7S3.5 18.4 3.5 14c0-1.8.5-3.5 1.5-5z" fill="#8a6c4f"/><circle cx="9" cy="13" r="1.3" fill="#fff"/><circle cx="15" cy="13" r="1.3" fill="#fff"/><path d="M11 16h2l-1 1.2z" fill="#f28cb1"/>'
];
const K_GAME = 'bp.memory.game';
const stats = BP.Stats('bp.memory.stats', LEVELS);
let G = null, open = [], lock = false, paused = false;

BP.header('Memory');
$('btnRestart').innerHTML = icons.restart + 'Rimescola';

const save = () => { if (G) store.set(K_GAME, G); };
function newGame(level) {
  const L = LEVELS[level];
  const kinds = shuffle([...ART.keys()]).slice(0, L.pairs);
  G = { level, deck: shuffle([...kinds, ...kinds]), got: [], moves: 0, elapsed: 0, done: false };
  stats.played(level);
  open = []; lock = false; paused = false;
  save(); BP.closeSheet(); build(); render();
}

/* ============ Disegno ============ */
const mem = $('mem');
let cards = [];
function build() {
  const L = LEVELS[G.level];
  mem.style.gridTemplateColumns = `repeat(${L.cols},1fr)`;
  mem.style.setProperty('--gap', L.pairs > 10 ? '8px' : '10px');
  mem.innerHTML = ''; cards = [];
  G.deck.forEach((kind, i) => {
    const c = document.createElement('button');
    c.className = 'card';
    c.setAttribute('aria-label', `Carta ${i + 1}`);
    c.innerHTML = `<div class="in"><div class="face back"><img src="../shared/mascot.svg" alt=""></div><div class="face front"><svg viewBox="0 0 24 24">${ART[kind]}</svg></div></div>`;
    c.addEventListener('click', () => flip(i));
    mem.appendChild(c); cards.push(c);
  });
  resize();
}
function resize() {
  if (!G) return;
  const L = LEVELS[G.level], rows = Math.ceil(G.deck.length / L.cols);
  const wide = matchMedia('(min-width:880px) and (min-height:560px)').matches;
  const H = wide ? innerHeight - 150 : innerHeight * 0.66;
  const byH = (H - rows * 10) / rows * 0.75 * L.cols + (L.cols - 1) * 10;
  mem.style.width = Math.min($('stage').clientWidth || innerWidth - 32, byH) + 'px';
}
window.addEventListener('resize', resize);
function render() {
  if (!G) return;
  cards.forEach((c, i) => {
    c.classList.toggle('up', open.includes(i));
    c.classList.toggle('got', G.got.includes(i));
  });
  $('lvl').textContent = LEVELS[G.level].label;
  $('moves').textContent = G.moves;
  $('pairs').textContent = `${G.got.length / 2}/${G.deck.length / 2}`;
  $('timer').textContent = fmt(G.elapsed);
  BP.setPauseIcon($('pauseIcon'), paused);
  mem.style.opacity = paused && !G.done ? '.3' : '';
}

/* ============ Gioco ============ */
function flip(i) {
  if (!G || G.done || lock || paused || G.got.includes(i) || open.includes(i)) return;
  open.push(i);
  render();
  if (open.length < 2) return;
  G.moves++;
  const [a, b] = open;
  if (G.deck[a] === G.deck[b]) {
    G.got.push(a, b); open = [];
    BP.fx('good', 15);
    if (G.got.length === G.deck.length) win();
    save(); render();
  } else {
    lock = true;
    cards[a].classList.add('no'); cards[b].classList.add('no');
    setTimeout(() => {
      cards[a].classList.remove('no'); cards[b].classList.remove('no');
      open = []; lock = false; save(); render();
    }, 850);
  }
}
function win() {
  G.done = true;
  const record = stats.won(G.level, G.elapsed);
  const perfect = G.moves === G.deck.length / 2;
  setTimeout(() => BP.sheet(`<h2>${perfect ? 'Memoria perfetta!' : 'Tutte le coppie!'}</h2>
    <p class="sub">${LEVELS[G.level].label}</p>${record ? '<span class="record">Nuovo record</span>' : ''}
    <div class="stats-grid"><div class="stat"><b>${fmt(G.elapsed)}</b><span>Tempo</span></div><div class="stat"><b>${G.moves}</b><span>Mosse</span></div><div class="stat"><b>${G.deck.length / 2}</b><span>Minimo</span></div></div>
    <button class="primary" data-act="new">Nuova partita</button><button class="ghost" data-act="close">Chiudi</button>`), 600);
}

$('btnRestart').onclick = () => { if (G && (G.done || confirm('Rimescolare le carte?'))) newGame(G.level); };
$('btnPause').onclick = () => { if (G && !G.done) { paused = !paused; render(); } };
$('btnNew').onclick = () => BP.levelPicker(LEVELS, { canContinue: !!G && !G.done });
$('btnStats').onclick = () => BP.statsSheet('Statistiche', stats);
$('btnHelp').onclick = () => BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
  <li>Tocca due carte per girarle.</li><li>Se sono uguali restano scoperte, altrimenti si rigirano.</li>
  <li>Trova tutte le coppie con meno mosse possibile: il minimo teorico è una mossa per coppia.</li></ul>
  <button class="primary" data-act="close">Ho capito</button>`);
BP.onSheet((act, d) => {
  if (act === 'new') BP.levelPicker(LEVELS);
  else if (act === 'level') newGame(d.level);
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) { stats.reset(); BP.statsSheet('Statistiche', stats); }
});
BP.ticker(() => {
  if (!G || G.done || paused) return;
  G.elapsed++; $('timer').textContent = fmt(G.elapsed);
  if (G.elapsed % 5 === 0) save();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

G = store.get(K_GAME, null);
const valid = g => g && LEVELS[g.level] && Array.isArray(g.deck) && g.deck.length === LEVELS[g.level].pairs * 2 &&
  g.deck.every(k => Number.isInteger(k) && k >= 0 && k < ART.length) && Array.isArray(g.got) && g.got.every(i => Number.isInteger(i) && i >= 0 && i < g.deck.length);
try {
  if (!valid(G)) throw new Error('salvataggio non valido');
  G.moves = Number.isFinite(G.moves) ? G.moves : 0; G.elapsed = Number.isFinite(G.elapsed) ? G.elapsed : 0;
  build(); render();
} catch { G = null; store.del(K_GAME); BP.levelPicker(LEVELS); }
BP.registerSW();
window.__game = { get state() { return G; }, flip };
})();
