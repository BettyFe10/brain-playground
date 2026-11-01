(() => {
'use strict';
const { $, store, randInt } = BP;
const N = 18;
const SPEEDS = { lento: { label: 'Lento', ms: 165, pts: 1 }, normale: { label: 'Normale', ms: 118, pts: 2 }, veloce: { label: 'Veloce', ms: 82, pts: 3 } };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const savedOpts = store.get('bp.snake.settings', {}) || {};
let opts = { speed: SPEEDS[savedOpts.speed] ? savedOpts.speed : 'normale', walls: savedOpts.walls === true };
let best = (() => {
  const b = { score: 0, byMode: {} }, saved = store.get('bp.snake.best', {}) || {};
  if (Number.isFinite(saved.score)) b.score = saved.score;
  if (saved.byMode && typeof saved.byMode === 'object') for (const [k, v] of Object.entries(saved.byMode)) if (/^(lento|normale|veloce)(-muri)?$/.test(k) && Number.isFinite(v)) b.byMode[k] = v;
  return b;
})();
let played = Number.isFinite(store.get('bp.snake.played', 0)) ? store.get('bp.snake.played', 0) : 0;
let S = null, state = 'menu', acc = 0, last = 0;

BP.header('Snake', { newLabel: 'Nuova', help: true, stats: true });

/* ============ Canvas ============ */
const cv = $('cv'), ctx = cv.getContext('2d'), arena = $('arena');
let px = 20, colors = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  colors = { bgA: v('--paper'), bgB: dark ? '#20232c' : '#f7f2e8', snake: dark ? '#6cc488' : '#4f9a60', snake2: dark ? '#3f8f5a' : '#7cc08a',
    food: v('--accent'), gold: dark ? '#ffd257' : '#e0a100', ink: v('--ink'), wall: v('--line-strong') };
}
function resize() {
  const r = arena.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  px = r.width / N;
  draw(1);
}
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); draw(1); });

/* ============ Logica ============ */
function newState() {
  const mid = Math.floor(N / 2);
  const body = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
  S = { body, prev: body.map(p => p.slice()), dir: 'right', queue: [], food: null, gold: null, goldT: 0, score: 0, eaten: 0, grow: 0, dead: false };
  placeFood();
}
function freeCell() {
  const occ = new Set(S.body.map(([x, y]) => y * N + x));
  if (S.food) occ.add(S.food[1] * N + S.food[0]);
  if (S.gold) occ.add(S.gold[1] * N + S.gold[0]);
  const free = [];
  for (let i = 0; i < N * N; i++) if (!occ.has(i)) free.push(i);
  if (!free.length) return null;
  const k = free[randInt(free.length)];
  return [k % N, Math.floor(k / N)];
}
function placeFood() { S.food = freeCell(); }
function turn(d) {
  if (state !== 'play') return;
  const lastDir = S.queue.length ? S.queue[S.queue.length - 1] : S.dir;
  const [ax, ay] = DIRS[lastDir], [bx, by] = DIRS[d];
  if (d === lastDir || (ax + bx === 0 && ay + by === 0)) return;
  if (S.queue.length < 2) S.queue.push(d);
}
function step() {
  if (S.queue.length) S.dir = S.queue.shift();
  const [dx, dy] = DIRS[S.dir];
  let [hx, hy] = S.body[0];
  hx += dx; hy += dy;
  if (opts.walls) {
    if (hx < 0 || hy < 0 || hx >= N || hy >= N) return die();
  } else { hx = (hx + N) % N; hy = (hy + N) % N; }
  const tailMoves = S.grow === 0;
  const hitsBody = S.body.some(([x, y], k) => x === hx && y === hy && !(tailMoves && k === S.body.length - 1));
  if (hitsBody) return die();
  S.prev = S.body.map(p => p.slice());
  S.body.unshift([hx, hy]);
  if (S.grow > 0) { S.grow--; S.prev.push(S.prev[S.prev.length - 1].slice()); } else S.body.pop();
  const pts = SPEEDS[opts.speed].pts;
  if (S.food && hx === S.food[0] && hy === S.food[1]) {
    S.score += pts; S.eaten++; S.grow += 1; BP.vibrate(15);
    placeFood();
    if (!S.gold && S.eaten % 5 === 0) { S.gold = freeCell(); S.goldT = 6000; }
  }
  if (S.gold && hx === S.gold[0] && hy === S.gold[1]) { S.score += pts * 5; S.grow += 2; S.gold = null; BP.vibrate([20, 40, 20]); }
  $('score').textContent = S.score;
}
function die() {
  S.dead = true; state = 'over'; BP.vibrate(120);
  played++; store.set('bp.snake.played', played);
  const key = opts.speed + (opts.walls ? '-muri' : '');
  const prevBest = best.byMode[key] || 0;
  const record = S.score > prevBest;
  if (record) best.byMode[key] = S.score;
  best.score = Math.max(best.score, S.score);
  store.set('bp.snake.best', best);
  showCover(`
    <h2>${record && S.score ? 'Nuovo record!' : 'Ahi!'}</h2>
    <div class="big">${S.score}</div>
    <p>${record && S.score ? 'Mai fatto meglio in questa modalità.' : `Record in questa modalità: ${prevBest}`}</p>
    <button class="go" id="goBtn">Gioca ancora</button>
    <button class="ghost" id="optBtn" style="margin-top:0;width:auto">Cambia impostazioni</button>`);
  $('goBtn').onclick = start;
  $('optBtn').onclick = menu;
  updateBar();
}

/* ============ Disegno ============ */
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function draw(t) {
  const W = px * N;
  ctx.fillStyle = colors.bgA; ctx.fillRect(0, 0, W, W);
  ctx.fillStyle = colors.bgB;
  for (let y = 0; y < N; y++) for (let x = (y % 2); x < N; x += 2) ctx.fillRect(x * px, y * px, px, px);
  if (opts.walls) { ctx.strokeStyle = colors.wall; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, W - 4); }
  if (!S) return;
  // cibo: una mela tonda con foglia
  if (S.food) {
    const [fx, fy] = S.food, cx = (fx + .5) * px, cy = (fy + .55) * px, pulse = 1 + Math.sin(performance.now() / 180) * .05;
    ctx.fillStyle = colors.food; ctx.beginPath(); ctx.arc(cx, cy, px * .36 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = colors.snake; ctx.beginPath(); ctx.ellipse(cx + px * .12, cy - px * .38, px * .13, px * .07, -.6, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(cx - px * .12, cy - px * .1, px * .07, 0, 7); ctx.fill();
  }
  if (S.gold) {
    const [gx, gy] = S.gold, cx = (gx + .5) * px, cy = (gy + .5) * px, r = px * .42, rot = performance.now() / 600;
    ctx.fillStyle = colors.gold; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.fill();
  }
  // serpente con movimento fluido tra un passo e l'altro
  const n = S.body.length;
  for (let k = n - 1; k >= 0; k--) {
    const [x1, y1] = S.body[k], [x0, y0] = S.prev[k] || S.body[k];
    const jump = Math.abs(x1 - x0) > 1 || Math.abs(y1 - y0) > 1;
    const x = jump ? x1 : x0 + (x1 - x0) * t, y = jump ? y1 : y0 + (y1 - y0) * t;
    const shrink = k === 0 ? 0.04 : 0.08 + (k / n) * 0.1;
    ctx.fillStyle = k % 2 ? colors.snake2 : colors.snake;
    roundRect((x + shrink) * px, (y + shrink) * px, px * (1 - shrink * 2), px * (1 - shrink * 2), px * .32);
    ctx.fill();
    if (k === 0) {
      const [dx, dy] = DIRS[S.dir];
      const ex = (x + .5) * px, ey = (y + .5) * px;
      const ox = dy !== 0 ? px * .2 : 0, oy = dx !== 0 ? px * .2 : 0;
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + ox * s + dx * px * .14, ey + oy * s + dy * px * .14, px * .15, 0, 7); ctx.fill();
        ctx.fillStyle = '#1f2a44'; ctx.beginPath(); ctx.arc(ex + ox * s + dx * px * .2, ey + oy * s + dy * px * .2, px * .075, 0, 7); ctx.fill();
      }
      if (S.dead) {
        ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex - px * .25, ey - px * .25); ctx.lineTo(ex + px * .25, ey + px * .25); ctx.stroke();
      }
    }
  }
}

/* ============ Ciclo di gioco ============ */
function loop(now) {
  const dt = Math.min(100, now - last); last = now;
  const tick = SPEEDS[opts.speed].ms;
  if (state === 'play') {
    acc += dt;
    if (S.gold) { S.goldT -= dt; if (S.goldT <= 0) S.gold = null; }
    while (acc >= tick && state === 'play') { acc -= tick; step(); }
  }
  draw(state === 'play' ? acc / tick : 1);
  requestAnimationFrame(loop);
}

/* ============ Schermate ============ */
function showCover(html) { const c = $('cover'); c.innerHTML = html; c.classList.add('show'); }
function hideCover() { $('cover').classList.remove('show'); }
function updateBar() {
  const key = opts.speed + (opts.walls ? '-muri' : '');
  $('modeTag').textContent = SPEEDS[opts.speed].label + (opts.walls ? ' · muri' : '');
  $('best').textContent = best.byMode[key] || 0;
  BP.setPauseIcon($('pauseIcon'), state !== 'play');
}
function menu() {
  state = 'menu';
  if (!S) newState();
  showCover(`
    <h2>Snake</h2>
    <p>Mangia le mele, evita la coda. Ogni 5 mele compare una stella che vale di più.</p>
    <div class="opts">
      <div class="seg" id="spdSeg">${Object.entries(SPEEDS).map(([k, v]) => `<button data-s="${k}" class="${opts.speed === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>
      <button class="setting" id="wallSw" style="border:0;padding:6px 4px"><div>Muri<small>Se tocchi il bordo perdi</small></div><span class="switch ${opts.walls ? 'on' : ''}"></span></button>
    </div>
    <button class="go" id="goBtn">Gioca</button>`);
  document.querySelectorAll('#spdSeg button').forEach(b => b.onclick = () => {
    opts.speed = b.dataset.s; store.set('bp.snake.settings', opts);
    document.querySelectorAll('#spdSeg button').forEach(x => x.classList.toggle('on', x === b)); updateBar();
  });
  $('wallSw').onclick = () => { opts.walls = !opts.walls; store.set('bp.snake.settings', opts); $('wallSw').lastElementChild.classList.toggle('on', opts.walls); updateBar(); draw(1); };
  $('goBtn').onclick = start;
  updateBar();
}
function start() {
  newState(); acc = 0; state = 'play';
  $('score').textContent = 0;
  hideCover(); updateBar();
}
function togglePause() {
  if (state === 'play') {
    state = 'pause';
    showCover('<h2>In pausa</h2><button class="go" id="goBtn">Riprendi</button>');
    $('goBtn').onclick = togglePause;
  } else if (state === 'pause') { state = 'play'; hideCover(); }
  updateBar();
}

/* ============ Controlli ============ */
BP.onSwipe($('app'), d => { if (state === 'play') turn(d); }, 14);
BP.joystick($('joy'), d => { if (state === 'menu' || state === 'over') return; turn(d); });
document.addEventListener('keydown', e => {
  if (BP.sheetOpen()) return;
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const d = map[e.key] || map[e.key.toLowerCase()];
  if (d) { e.preventDefault(); if (state === 'menu' || state === 'over') start(); turn(d); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
  if (e.key === 'Enter' && state !== 'play') start();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
$('btnPause').onclick = togglePause;
$('btnNew').onclick = () => { if (state === 'play') state = 'pause'; menu(); };
$('btnStats').onclick = () => {
  if (state === 'play') togglePause();
  const rows = [];
  for (const [k, v] of Object.entries(SPEEDS)) for (const w of [false, true]) rows.push(`<tr><td>${v.label}${w ? ' · muri' : ''}</td><td>${best.byMode[k + (w ? '-muri' : '')] || 0}</td></tr>`);
  BP.sheet(`<h2>Record</h2>
    <div class="stats-grid"><div class="stat"><b>${best.score}</b><span>Miglior punteggio</span></div><div class="stat"><b>${played}</b><span>Partite</span></div><div class="stat"><b>${SPEEDS[opts.speed].pts}x</b><span>Punti per mela</span></div></div>
    <table><thead><tr><th>Modalità</th><th>Record</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <button class="danger" data-act="resetStats">Azzera record</button>
    <button class="primary" data-act="close">Chiudi</button>`);
};
$('btnHelp').onclick = () => {
  if (state === 'play') togglePause();
  BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
    <li>Guida il serpente con uno <b>swipe</b> sul campo, con le frecce sotto o da tastiera.</li>
    <li>Ogni mela allunga il serpente. Le stelle dorate valgono 5 mele ma spariscono dopo qualche secondo.</li>
    <li>Più è veloce, più punti vale ogni mela.</li>
    <li>Senza muri esci da un lato e rientri dall'altro.</li></ul>
    <button class="primary" data-act="close">Ho capito</button>`);
};
BP.onSheet(act => {
  if (act === 'resetStats' && confirm('Azzerare i record?')) { best = { score: 0, byMode: {} }; played = 0; store.set('bp.snake.best', best); store.set('bp.snake.played', 0); BP.closeSheet(); updateBar(); }
});

readColors();
resize();
menu();
requestAnimationFrame(t => { last = t; loop(t); });
BP.registerSW();
window.__game = { get state() { return { S, state }; }, step, turn };
})();
