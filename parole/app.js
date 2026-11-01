(() => {
'use strict';
const { $, store } = BP;
const VALID = new Set(window.VALID.split(' '));
const ANSWERS = window.ANSWERS;
const K_DAILY = 'bp.parole.daily', K_FREE = 'bp.parole.game', K_STATS = 'bp.parole.stats', K_MODE = 'bp.parole.mode';
const freshStats = () => ({ played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0], lastDaily: null });
let stats = (() => {
  const s = freshStats(), saved = store.get(K_STATS, {}) || {};
  for (const k of ['played', 'won', 'streak', 'maxStreak']) if (Number.isFinite(saved[k])) s[k] = saved[k];
  if (Array.isArray(saved.dist) && saved.dist.length === 6 && saved.dist.every(Number.isFinite)) s.dist = saved.dist;
  if (typeof saved.lastDaily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.lastDaily)) s.lastDaily = saved.lastDaily;
  return s;
})();
let mode = store.get(K_MODE, 'daily') === 'free' ? 'free' : 'daily';
const validGame = g => g && typeof g.answer === 'string' && /^[a-z]{5}$/.test(g.answer) && Array.isArray(g.guesses) &&
  g.guesses.length <= 6 && g.guesses.every(w => typeof w === 'string' && /^[a-z]{5}$/.test(w));
let G = null, typing = '', busy = false;

BP.header('Parole', { newLabel: '' });

/* ============ Parola del giorno: ordine fisso e mescolato ============ */
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function seededOrder() {
  let s = 20261101;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const a = ANSWERS.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const ORDER = seededOrder();
function dailyWord(key) {
  const [y, m, d] = key.split('-').map(Number);
  const days = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(2026, 10, 1)) / 86400000);
  return ORDER[((days % ORDER.length) + ORDER.length) % ORDER.length];
}

function loadGame() {
  if (mode === 'daily') {
    const k = dayKey();
    G = store.get(K_DAILY, null);
    if (!validGame(G) || G.day !== k) G = { mode: 'daily', day: k, answer: dailyWord(k), guesses: [], done: false, won: false };
  } else {
    G = store.get(K_FREE, null);
    if (!validGame(G)) newFree();
  }
  typing = '';
}
function newFree() {
  G = { mode: 'free', answer: ANSWERS[BP.randInt(ANSWERS.length)], guesses: [], done: false, won: false };
  typing = ''; save();
}
const save = () => store.set(mode === 'daily' ? K_DAILY : K_FREE, G);
const saveStats = () => store.set(K_STATS, stats);

/* ============ Valutazione con gestione delle lettere doppie ============ */
function score(guess, answer) {
  const res = Array(5).fill('miss'), left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) res[i] = 'hit';
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'hit') continue;
    if (left[guess[i]]) { res[i] = 'near'; left[guess[i]]--; }
  }
  return res;
}

/* ============ Rendering ============ */
const grid = $('grid'), kb = $('kb');
const rows = [];
for (let r = 0; r < 6; r++) {
  const row = document.createElement('div'); row.className = 'row';
  for (let c = 0; c < 5; c++) row.appendChild(Object.assign(document.createElement('div'), { className: 'tile' }));
  grid.appendChild(row); rows.push(row);
}
const LAYOUT = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];
const keyEls = {};
LAYOUT.forEach(line => {
  const kr = document.createElement('div'); kr.className = 'kr';
  for (const ch of line) {
    const b = document.createElement('button');
    b.className = 'key';
    if (ch === '+') { b.classList.add('wide'); b.textContent = 'Invio'; b.onclick = submit; }
    else if (ch === '-') {
      b.classList.add('wide');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-7 7 7 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m18 9-6 6M12 9l6 6"/></svg>';
      b.setAttribute('aria-label', 'Cancella'); b.onclick = back;
    } else { b.textContent = ch; b.onclick = () => type(ch); keyEls[ch] = b; }
    kr.appendChild(b);
  }
  kb.appendChild(kr);
});

function render(animateRow = -1) {
  const rank = { miss: 1, near: 2, hit: 3 }, keyState = {};
  rows.forEach((row, r) => {
    const g = G.guesses[r];
    const tiles = row.children;
    row.classList.remove('win');
    for (let c = 0; c < 5; c++) {
      const t = tiles[c];
      t.className = 'tile';
      t.style.animationDelay = '';
      if (g) {
        t.textContent = g[c];
        const s = score(g, G.answer)[c];
        t.classList.add(s);
        if (r === animateRow) t.style.animationDelay = (c * 140) + 'ms';
        else t.style.animation = 'none';
        if (!keyState[g[c]] || rank[s] > rank[keyState[g[c]]]) keyState[g[c]] = s;
      } else if (r === G.guesses.length && !G.done) {
        t.textContent = typing[c] || '';
        if (typing[c]) t.classList.add('filled');
        t.style.animation = '';
      } else { t.textContent = ''; t.style.animation = ''; }
    }
  });
  const apply = () => Object.entries(keyEls).forEach(([ch, el]) => { el.className = 'key' + (keyState[ch] ? ' ' + keyState[ch] : ''); });
  if (animateRow >= 0) setTimeout(apply, 5 * 140 + 300); else apply();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
}

/* ============ Input ============ */
function type(ch) {
  if (!G || G.done || busy || typing.length >= 5) return;
  typing += ch; render();
}
function back() { if (!G || G.done || busy) return; typing = typing.slice(0, -1); render(); }
function submit() {
  if (!G || G.done || busy) return;
  const row = rows[G.guesses.length];
  if (typing.length < 5) { shake(row); BP.toast('Servono 5 lettere'); return; }
  if (!VALID.has(typing)) { shake(row); BP.toast('Non conosco questa parola'); return; }
  G.guesses.push(typing);
  const guessed = typing === G.answer;
  typing = '';
  busy = true;
  render(G.guesses.length - 1);
  setTimeout(() => {
    busy = false;
    if (guessed || G.guesses.length === 6) finish(guessed);
    save();
  }, 5 * 140 + 400);
  save();
}
function shake(row) { row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); BP.fx('error', 40); }
function finish(won) {
  G.done = true; G.won = won;
  stats.played++;
  if (won) { stats.won++; stats.dist[G.guesses.length - 1]++; }
  BP.sfx(won ? 'win' : 'lose');
  if (G.mode === 'daily') {
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    if (won) { stats.streak = stats.lastDaily === yesterday ? stats.streak + 1 : 1; stats.maxStreak = Math.max(stats.maxStreak, stats.streak); stats.lastDaily = G.day; }
    else stats.streak = 0;
  }
  saveStats(); save();
  if (won) {
    const row = rows[G.guesses.length - 1];
    [...row.children].forEach((t, c) => { t.style.animation = ''; t.style.animationDelay = (c * 90) + 'ms'; });
    row.classList.add('win');
  }
  const msgs = ['Genio!', 'Fantastico!', 'Bravissima!', 'Ottimo!', 'Bene!', 'Per un pelo!'];
  setTimeout(() => showStats(won ? msgs[G.guesses.length - 1] : 'Peccato!'), won ? 900 : 300);
}

/* ============ Statistiche e condivisione ============ */
function shareText() {
  const map = { hit: '🟩', near: '🟨', miss: '⬜' };
  const lines = G.guesses.map(g => score(g, G.answer).map(s => map[s]).join(''));
  const head = G.mode === 'daily' ? `Parole ${G.day}` : 'Parole (libera)';
  return `${head} ${G.won ? G.guesses.length : 'X'}/6\n\n${lines.join('\n')}`;
}
function showStats(title = 'Statistiche') {
  const max = Math.max(1, ...stats.dist);
  const mine = G && G.done && G.won ? G.guesses.length - 1 : -1;
  const ended = G && G.done;
  BP.sheet(`
    <h2>${title}</h2>
    ${ended ? `<p class="sub">${G.won ? 'La parola era' : 'La parola era'}</p><div class="answer">${G.answer}</div>` : ''}
    <div class="stats-grid">
      <div class="stat"><b>${stats.played}</b><span>Giocate</span></div>
      <div class="stat"><b>${stats.played ? Math.round(stats.won / stats.played * 100) : 0}%</b><span>Vinte</span></div>
      <div class="stat"><b>${stats.streak}</b><span>Serie (max ${stats.maxStreak})</span></div>
    </div>
    <div class="section-title">Tentativi</div>
    <div class="dist">${stats.dist.map((v, k) => `<div class="bar"><b>${k + 1}</b><span class="${k === mine ? 'me' : ''}" style="width:${Math.max(8, v / max * 100)}%">${v}</span></div>`).join('')}</div>
    ${ended ? '<button class="primary" data-act="share">Copia il risultato</button>' : ''}
    ${ended && G.mode === 'daily' ? '<button class="ghost" data-act="goFree">Gioca in modalità libera</button>' : ''}
    ${ended && G.mode === 'free' ? '<button class="primary" data-act="again">Un\'altra parola</button>' : ''}
    ${!ended ? '<button class="danger" data-act="resetStats">Azzera statistiche</button><button class="primary" data-act="close">Chiudi</button>' : '<button class="ghost" data-act="close">Chiudi</button>'}
  `);
}
BP.onSheet(act => {
  if (act === 'share') {
    const txt = shareText();
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => BP.toast('Copiato! Incollalo dove vuoi'),
      () => BP.toast('Copia non disponibile su questo browser'));
  } else if (act === 'goFree') { setMode('free'); BP.closeSheet(); }
  else if (act === 'again') { newFree(); BP.closeSheet(); render(); }
  else if (act === 'resetStats' && confirm('Azzerare le statistiche?')) {
    stats = freshStats();
    saveStats(); showStats();
  }
});
function setMode(m) { mode = m; store.set(K_MODE, m); loadGame(); render(); }
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => {
  if (b.dataset.mode === 'free' && mode === 'free' && G.done) newFree();
  setMode(b.dataset.mode);
});
$('btnStats').onclick = () => showStats();
$('btnHelp').onclick = () => BP.sheet(`
  <h2>Come si gioca</h2>
  <ul class="rules">
    <li>Indovina la parola italiana di 5 lettere in 6 tentativi.</li>
    <li><b style="color:var(--hit)">Verde</b>: lettera giusta al posto giusto.</li>
    <li><b style="color:var(--near)">Giallo</b>: la lettera c'è, ma in un altro punto.</li>
    <li><b style="color:var(--muted)">Grigio</b>: la lettera non c'è.</li>
    <li><b>Del giorno</b>: una parola al giorno, uguale per tutti, con la serie di giorni vinti. <b>Libera</b>: parole infinite.</li>
    <li>Niente accenti: scrivi "citta" e non "città".</li>
  </ul>
  <button class="primary" data-act="close">Ho capito</button>`);

document.addEventListener('keydown', e => {
  if (BP.sheetOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') { e.preventDefault(); submit(); }
  else if (e.key === 'Backspace') back();
  else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
});
// a mezzanotte la parola del giorno cambia anche con l'app aperta
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && mode === 'daily' && G && G.day !== dayKey()) { loadGame(); render(); }
});

loadGame();
render();
if (!store.get('bp.parole.seenHelp', false)) { store.set('bp.parole.seenHelp', true); $('btnHelp').onclick(); }
BP.registerSW();
window.__game = { get state() { return G; }, score, VALID, ANSWERS, dailyWord };
})();
