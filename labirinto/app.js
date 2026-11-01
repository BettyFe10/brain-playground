(() => {
'use strict';
const { $, store, randInt, shuffle } = BP;
const W = 19, H = 21, MID = 9;
const WALL = 1, PATH = 0, PEN = 2, DOOR = 3;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
let best = (() => {
  const b = { score: 0, level: 0 }, saved = store.get('bp.labirinto.best', {}) || {};
  if (Number.isFinite(saved.score)) b.score = saved.score;
  if (Number.isFinite(saved.level)) b.level = saved.level;
  return b;
})();
let played = Number.isFinite(store.get('bp.labirinto.played', 0)) ? store.get('bp.labirinto.played', 0) : 0;

BP.header('Labirinto');

/* ============ Generatore di labirinti (simmetrici, con anelli) ============ */
function genMaze() {
  const g = Array.from({ length: H }, () => new Array(W).fill(WALL));
  const open = (x, y, v = PATH) => { g[y][x] = v; g[y][W - 1 - x] = v; };
  const inner = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  // 1) labirinto perfetto sulla metà sinistra (colonna centrale inclusa), poi specchiato
  const seen = new Set(), stack = [[1, 1]];
  open(1, 1); seen.add('1,1');
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const nb = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).map(([dx, dy]) => [x + dx, y + dy, dx, dy])
      .filter(([nx, ny]) => nx >= 1 && nx <= MID && ny >= 1 && ny < H - 1 && !seen.has(nx + ',' + ny));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[0];
    open(x + dx / 2, y + dy / 2); open(nx, ny);
    seen.add(nx + ',' + ny); stack.push([nx, ny]);
  }
  // 2) recinto centrale dei Brontoli con corridoio tutto intorno
  for (let y = 8; y <= 12; y++) for (let x = 6; x <= MID; x++) {
    if (y === 8 || y === 12 || x === 6) open(x, y);
    else if (y === 10 && x >= 8) open(x, y, PEN);
    else open(x, y, WALL);
  }
  g[9][MID] = DOOR;
  const isPath = (x, y) => inner(x, y) && g[y][x] === PATH;
  const inPenArea = (x, y) => y >= 8 && y <= 12 && x >= 6 && x <= 12;
  // 3) niente vicoli ciechi: i nemici devono poter girare intorno
  const braid = () => {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x <= MID; x++) {
      if (g[y][x] !== PATH) continue;
      const exits = Object.values(DIRS).filter(([dx, dy]) => g[y + dy][x + dx] === PATH || g[y + dy][x + dx] === DOOR).length;
      if (exits >= 2) continue;
      const cand = shuffle(Object.values(DIRS)).filter(([dx, dy]) => {
        const wx = x + dx, wy = y + dy;
        return inner(wx, wy) && g[wy][wx] === WALL && !inPenArea(wx, wy) && isPath(x + 2 * dx, y + 2 * dy) && wx <= MID;
      });
      if (cand.length) open(x + cand[0][0], y + cand[0][1]);
    }
  };
  braid(); braid();
  // 4) qualche anello in più, per avere più vie di fuga
  for (let k = 0; k < 7; k++) {
    const x = 1 + randInt(MID), y = 1 + randInt(H - 2);
    if (g[y][x] !== WALL || inPenArea(x, y)) continue;
    if ((isPath(x - 1, y) && isPath(x + 1, y) && !isPath(x, y - 1) && !isPath(x, y + 1)) ||
        (isPath(x, y - 1) && isPath(x, y + 1) && !isPath(x - 1, y) && !isPath(x + 1, y))) open(x, y);
  }
  // 5) partenza del giocatore e collegamento di tutto il labirinto
  const start = [MID, 15];
  g[15][MID] = PATH;
  for (let guard = 0; guard < 200; guard++) {
    const reach = new Set([start[1] * W + start[0]]), q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, k = ny * W + nx;
        if (isPath(nx, ny) && !reach.has(k)) { reach.add(k); q.push([nx, ny]); }
      }
    }
    let fixed = false, lonely = false;
    for (let y = 1; y < H - 1 && !fixed; y++) for (let x = 1; x < W - 1 && !fixed; x++) {
      if (g[y][x] !== PATH || reach.has(y * W + x)) continue;
      lonely = true;
      for (const [dx, dy] of shuffle(Object.values(DIRS))) {
        const wx = x + dx, wy = y + dy;
        if (inner(wx, wy) && g[wy][wx] === WALL && !inPenArea(wx, wy) && reach.has((wy + dy) * W + (wx + dx))) {
          open(wx <= MID ? wx : W - 1 - wx, wy); fixed = true; break;
        }
      }
    }
    if (!lonely) break;
    if (!fixed) braid();
  }
  braid();
  return { g, start };
}

/* ============ Stato di gioco ============ */
let M, dots, totalDots, P, E, score, lives, level, mode, modeT, fright, frightChain, state = 'menu', readyT = 0, popups = [];
const ENEMY_COLORS = ['#e2725b', '#6a8fe0', '#58b37a', '#b07ad8'];
function buildLevel() {
  M = genMaze();
  dots = new Map();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (M.g[y][x] !== PATH) continue;
    if (y >= 8 && y <= 12 && x >= 6 && x <= 12) continue;
    if (x === M.start[0] && y === M.start[1]) continue;
    dots.set(y * W + x, 'dot');
  }
  // energie negli angoli (la casella più vicina a ogni angolo)
  for (const [cx, cy] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]]) {
    let bestK = -1, bd = 1e9;
    for (const k of dots.keys()) { const x = k % W, y = Math.floor(k / W), d = Math.abs(x - cx) + Math.abs(y - cy); if (d < bd) { bd = d; bestK = k; } }
    if (bestK >= 0) dots.set(bestK, 'power');
  }
  totalDots = dots.size;
  renderMazeLayer();
  resetActors();
}
function actor(x, y, dir) { return { x, y, tx: x, ty: y, dir, want: dir, prog: 0, moving: false }; }
function resetActors() {
  P = actor(M.start[0], M.start[1], 'left');
  E = [0, 1, 2, 3].map(i => {
    const e = actor(i === 0 ? MID : 8 + (i - 1), i === 0 ? 8 : 10, 'left');
    e.id = i; e.inPen = i !== 0; e.release = [0, 2.5, 6, 10][i]; e.eaten = false; e.wait = 0;
    return e;
  });
  mode = 'scatter'; modeT = 6; fright = 0; frightChain = 0;
  readyT = 1.6;
}
function newGame() {
  score = 0; lives = 3; level = 1;
  buildLevel(); state = 'play'; hideCover(); updateBar(); kick();
}

/* ============ Movimento su griglia ============ */
const walkable = (x, y, forEnemy) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const v = M.g[y][x];
  return v === PATH || (forEnemy && (v === DOOR || v === PEN));
};
const canGo = (a, dir, forEnemy) => { const [dx, dy] = DIRS[dir]; return walkable(a.tx + dx, a.ty + dy, forEnemy && a.leaving); };
function advance(a, speed, dt, decide) {
  let dist = speed * dt;
  let guard = 0;
  while (dist > 0 && guard++ < 6) {
    if (!a.moving) {
      decide(a);
      if (!a.moving) return;
    }
    const need = 1 - a.prog;
    if (dist < need) { a.prog += dist; dist = 0; }
    else {
      dist -= need; a.prog = 0;
      const [dx, dy] = DIRS[a.dir];
      a.tx += dx; a.ty += dy; a.moving = false;
      onArrive(a);
    }
  }
  const [dx, dy] = DIRS[a.dir];
  a.x = a.tx + (a.moving ? dx * a.prog : 0);
  a.y = a.ty + (a.moving ? dy * a.prog : 0);
}
function decidePlayer(a) {
  if (canGo(a, a.want)) a.dir = a.want;
  a.moving = canGo(a, a.dir);
}
function onArrive(a) {
  if (a !== P) return;
  const k = a.ty * W + a.tx, d = dots.get(k);
  if (!d) return;
  dots.delete(k);
  if (d === 'dot') score += 10;
  else { score += 50; fright = Math.max(3, 7 - level * 0.5); frightChain = 0; E.forEach(e => { if (!e.inPen && !e.eaten && !e.leaving) { reverse(e); e.scared = true; } }); BP.vibrate(25); }
  if (!dots.size) levelUp();
}
function targetFor(e) {
  const corners = [[W - 2, 0], [1, 0], [W - 2, H - 1], [1, H - 1]];
  if (mode === 'scatter') return corners[e.id];
  const [pdx, pdy] = DIRS[P.dir];
  if (e.id === 0) return [P.tx, P.ty];
  if (e.id === 1) return [P.tx + pdx * 4, P.ty + pdy * 4];
  if (e.id === 2) { const d = Math.hypot(e.tx - P.tx, e.ty - P.ty); return d > 7 ? [P.tx, P.ty] : corners[2]; }
  return Math.random() < 0.5 ? [P.tx, P.ty] : [randInt(W), randInt(H)];
}
function decideEnemy(e) {
  if (e.leaving) {
    // esce dal recinto puntando alla porta
    const goal = e.ty > 9 ? [MID, 9] : [MID, 8];
    if (e.tx === MID && e.ty === 8) { e.leaving = false; }
    else {
      const opts = Object.keys(DIRS).filter(d => canGo(e, d, true));
      opts.sort((a, b) => dist2(e, a, goal) - dist2(e, b, goal));
      e.dir = opts[0]; e.moving = true; return;
    }
  }
  let opts = Object.keys(DIRS).filter(d => d !== OPP[e.dir] && canGo(e, d, false));
  if (!opts.length) opts = Object.keys(DIRS).filter(d => canGo(e, d, false));
  if (!opts.length) { e.moving = false; return; }
  if (e.scared && fright > 0) e.dir = opts[randInt(opts.length)];
  else {
    const t = targetFor(e);
    opts.sort((a, b) => dist2(e, a, t) - dist2(e, b, t));
    e.dir = opts[0];
  }
  e.moving = true;
}
// inverte la direzione anche a metà casella, senza far "saltare" il personaggio
function reverse(a) {
  if (a.moving) { const [dx, dy] = DIRS[a.dir]; a.tx += dx; a.ty += dy; a.prog = 1 - a.prog; }
  a.dir = OPP[a.dir];
}
const dist2 = (e, d, [gx, gy]) => { const [dx, dy] = DIRS[d]; return (e.tx + dx - gx) ** 2 + (e.ty + dy - gy) ** 2; };

/* ============ Aggiornamento ============ */
let elapsedPlay = 0;
function update(dt) {
  if (state !== 'play') return;
  if (readyT > 0) { readyT -= dt; return; }
  elapsedPlay += dt;
  if (fright > 0) { fright -= dt; if (fright <= 0) E.forEach(e => e.scared = false); }
  else { modeT -= dt; if (modeT <= 0) { mode = mode === 'scatter' ? 'chase' : 'scatter'; modeT = mode === 'chase' ? 20 : 5; E.forEach(e => { if (!e.inPen && !e.eaten && !e.leaving) reverse(e); }); } }
  const pSpeed = 6.2 + Math.min(level, 8) * 0.12;
  advance(P, pSpeed, dt, decidePlayer);
  for (const e of E) {
    if (e.eaten) { e.wait -= dt; if (e.wait <= 0) { e.eaten = false; e.inPen = true; e.release = 0; } continue; }
    if (e.inPen) {
      e.release -= dt;
      e.x = e.tx; e.y = e.ty + Math.sin(elapsedPlay * 6 + e.id) * 0.15;
      if (e.release <= 0) { e.inPen = false; e.leaving = true; e.moving = false; e.prog = 0; e.y = e.ty; }
      continue;
    }
    const sp = e.scared && fright > 0 ? 3.4 : (4.9 + Math.min(level, 8) * 0.22);
    advance(e, sp, dt, decideEnemy);
  }
  // collisioni
  for (const e of E) {
    if (e.inPen || e.eaten) continue;
    if (Math.hypot(e.x - P.x, e.y - P.y) < 0.7) {
      if (e.scared && fright > 0) {
        frightChain++;
        const pts = 200 * 2 ** (frightChain - 1);
        score += pts; popups.push({ x: e.x, y: e.y, t: 1, txt: pts });
        e.eaten = true; e.scared = false; e.wait = 3; e.tx = MID; e.ty = 10; e.x = MID; e.y = 10; e.prog = 0; e.moving = false;
        BP.vibrate(30);
      } else return loseLife();
    }
  }
  popups = popups.filter(p => (p.t -= dt) > 0);
  $('score').textContent = score;
}
function loseLife() {
  lives--; BP.vibrate(150); updateBar();
  if (lives <= 0) return gameOver();
  resetActors();
}
function levelUp() {
  level++; score += 500;
  state = 'between';
  showCover(`<h2>Livello ${level - 1} completato!</h2><p>+500 punti. I Brontoli adesso sono un po' più veloci.</p><button class="go" id="goBtn">Avanti</button>`);
  $('goBtn').onclick = () => { buildLevel(); state = 'play'; hideCover(); updateBar(); kick(); };
}
function gameOver() {
  state = 'over';
  played++; store.set('bp.labirinto.played', played);
  const record = score > best.score;
  if (record) best.score = score;
  best.level = Math.max(best.level, level);
  store.set('bp.labirinto.best', best);
  showCover(`
    <h2>${record ? 'Nuovo record!' : 'Preso!'}</h2>
    <div class="big">${score}</div>
    <p>Sei arrivata al livello ${level}. ${record ? '' : `Record: ${best.score}`}</p>
    <button class="go" id="goBtn">Gioca ancora</button>`);
  $('goBtn').onclick = newGame;
  updateBar();
}

/* ============ Disegno ============ */
const cv = $('cv'), ctx = cv.getContext('2d'), arena = $('arena');
const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
let ts = 20, colors = {}, dpr = 1;
function readColors() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  colors = { wall: dark ? '#2b3550' : '#cddbf3', path: v('--paper'), dot: dark ? '#e8e3d8' : '#c9a98a', power: v('--accent'), ink: v('--ink'),
    player: dark ? '#ffd257' : '#f2b705', scared: dark ? '#9fb4e8' : '#a9bfe8', door: v('--accent') };
}
function resize() {
  const r = arena.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ts = r.width / W;
  renderMazeLayer();
  if (!running) draw();
}
function renderMazeLayer() {
  if (!M) return;
  layer.width = cv.width; layer.height = cv.height;
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.fillStyle = colors.wall; lctx.fillRect(0, 0, W * ts, H * ts);
  lctx.fillStyle = colors.path;
  const pad = ts * 0.1, rr = ts * 0.4;
  const isOpen = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M.g[y][x] !== WALL;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isOpen(x, y)) continue;
    lctx.beginPath();
    lctx.roundRect ? lctx.roundRect(x * ts + pad, y * ts + pad, ts - 2 * pad, ts - 2 * pad, rr) : lctx.rect(x * ts + pad, y * ts + pad, ts - 2 * pad, ts - 2 * pad);
    lctx.fill();
    if (isOpen(x + 1, y)) lctx.fillRect(x * ts + ts / 2, y * ts + pad, ts, ts - 2 * pad);
    if (isOpen(x, y + 1)) lctx.fillRect(x * ts + pad, y * ts + ts / 2, ts - 2 * pad, ts);
  }
  // porta del recinto
  lctx.fillStyle = colors.door;
  lctx.fillRect(MID * ts + ts * 0.15, 9 * ts + ts * 0.42, ts * 0.7, ts * 0.16);
}
function drawPlayer() {
  const cx = (P.x + .5) * ts, cy = (P.y + .5) * ts, r = ts * .42;
  const [dx, dy] = DIRS[P.dir];
  const squish = P.moving && state === 'play' ? Math.sin(performance.now() / 70) * 0.06 : 0;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + squish, 1 - squish);
  ctx.fillStyle = colors.player;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-r, -r, r * 2, r * 2, r * .7) : ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(232,110,110,.45)';
  ctx.beginPath(); ctx.arc(-r * .55, r * .25, r * .2, 0, 7); ctx.arc(r * .55, r * .25, r * .2, 0, 7); ctx.fill();
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * .35 + dx * r * .15, -r * .12 + dy * r * .15, r * .26, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f2a44'; ctx.beginPath(); ctx.arc(s * r * .35 + dx * r * .26, -r * .12 + dy * r * .26, r * .13, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = Math.max(1.2, ts * .06); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(dx * r * .1, r * .3, r * .18, .15 * Math.PI, .85 * Math.PI); ctx.stroke();
  ctx.restore();
}
function drawEnemy(e) {
  if (e.eaten) return;
  const cx = (e.x + .5) * ts, cy = (e.y + .5) * ts, r = ts * .42;
  const scared = e.scared && fright > 0;
  const flash = scared && fright < 2 && Math.floor(performance.now() / 180) % 2;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = scared ? (flash ? '#fff' : colors.scared) : ENEMY_COLORS[e.id];
  // corpo a nuvoletta: tre bolle sopra, base piatta e arrotondata
  ctx.beginPath();
  ctx.arc(-r * .5, -r * .15, r * .5, 0, 7); ctx.arc(r * .5, -r * .15, r * .5, 0, 7); ctx.arc(0, -r * .45, r * .55, 0, 7);
  ctx.fill();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-r, -r * .2, r * 2, r * 1.15, r * .35) : ctx.rect(-r, -r * .2, r * 2, r * 1.15); ctx.fill();
  if (scared) {
    ctx.fillStyle = '#1f2a44';
    ctx.beginPath(); ctx.arc(-r * .3, -r * .1, r * .1, 0, 7); ctx.arc(r * .3, -r * .1, r * .1, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = Math.max(1.2, ts * .05);
    ctx.beginPath(); for (let k = 0; k <= 4; k++) ctx.lineTo(-r * .4 + k * r * .2, r * .35 + (k % 2 ? -1 : 1) * r * .08); ctx.stroke();
  } else {
    const [dx, dy] = DIRS[e.dir];
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * .32, 0, r * .24, 0, 7); ctx.fill();
      ctx.fillStyle = '#1f2a44'; ctx.beginPath(); ctx.arc(s * r * .32 + dx * r * .1, dy * r * .1, r * .12, 0, 7); ctx.fill();
      // sopracciglia imbronciate
      ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = Math.max(1.2, ts * .06); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s * r * .55, -r * .38); ctx.lineTo(s * r * .12, -r * .24); ctx.stroke();
    }
  }
  ctx.restore();
}
function draw() {
  if (!M) { ctx.clearRect(0, 0, cv.width, cv.height); return; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
  const t = performance.now();
  for (const [k, kind] of dots) {
    const x = (k % W + .5) * ts, y = (Math.floor(k / W) + .5) * ts;
    if (kind === 'dot') { ctx.fillStyle = colors.dot; ctx.beginPath(); ctx.arc(x, y, ts * .1, 0, 7); ctx.fill(); }
    else {
      const s = ts * (.22 + Math.sin(t / 200) * .04);
      ctx.fillStyle = colors.power; ctx.beginPath();
      ctx.moveTo(x, y + s * .9);
      ctx.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .6, y - s * 1.4, x, y - s * .45);
      ctx.bezierCurveTo(x + s * .6, y - s * 1.4, x + s * 1.6, y - s * .2, x, y + s * .9);
      ctx.fill();
    }
  }
  E.forEach(drawEnemy);
  drawPlayer();
  ctx.fillStyle = colors.ink; ctx.font = `800 ${ts * .7}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center';
  for (const p of popups) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillText(p.txt, (p.x + .5) * ts, (p.y + .2 - (1 - p.t)) * ts); }
  ctx.globalAlpha = 1;
  if (state === 'play' && readyT > 0) {
    ctx.fillStyle = colors.power; ctx.font = `800 ${ts * .95}px Nunito, system-ui, sans-serif`;
    ctx.fillText('Pronti!', (MID + .5) * ts, 13.75 * ts);
  }
}
let last = 0;
// il ciclo di disegno gira solo durante il gioco: in pausa o nei menu la CPU (e la batteria) riposa
let running = false;
function kick() {
  if (running) return;
  running = true;
  requestAnimationFrame(t => { last = t; loop(t); });
}
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  if (state === 'play') requestAnimationFrame(loop); else running = false;
}

/* ============ Schermate e controlli ============ */
function showCover(html) { const c = $('cover'); c.innerHTML = html; c.classList.add('show'); }
function hideCover() { $('cover').classList.remove('show'); }
function updateBar() {
  $('lvl').textContent = `Livello ${level || 1}`;
  $('score').textContent = score || 0;
  $('lives').innerHTML = [0, 1, 2].map(k => `<i class="${k < (lives ?? 3) ? '' : 'off'}"></i>`).join('');
  BP.setPauseIcon($('pauseIcon'), state !== 'play');
}
function menu() {
  state = 'menu';
  showCover(`
    <h2>Labirinto</h2>
    <p>Aiuta <b>Bip</b> a raccogliere tutti i semini. Attenta ai <b>Brontoli</b>: mangia un cuore e per qualche secondo saranno loro a scappare.</p>
    <p>Record: <b>${best.score}</b></p>
    <button class="go" id="goBtn">Gioca</button>`);
  $('goBtn').onclick = newGame;
  updateBar();
}
function steer(d) {
  if (state === 'menu' || state === 'over') return;
  if (state !== 'play' || !P) return;
  P.want = d;
  // inversione immediata a metà strada
  if (P.moving && d === OPP[P.dir]) reverse(P);
}
function togglePause() {
  if (state === 'play') {
    state = 'pause';
    showCover('<h2>In pausa</h2><button class="go" id="goBtn">Riprendi</button>');
    $('goBtn').onclick = togglePause;
  } else if (state === 'pause') { state = 'play'; hideCover(); kick(); }
  updateBar();
}
BP.onSwipe($('app'), d => { if (state === 'play') steer(d); }, 14);
BP.joystick($('joy'), steer);
document.addEventListener('keydown', e => {
  if (BP.sheetOpen()) return;
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const d = map[e.key] || map[e.key.toLowerCase()];
  if (d) { e.preventDefault(); steer(d); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
  if (e.key === 'Enter' && (state === 'menu' || state === 'over')) newGame();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
$('btnPause').onclick = togglePause;
$('btnNew').onclick = () => { if (state === 'play' || state === 'pause') { if (!confirm('Iniziare una nuova partita?')) return; } newGame(); };
$('btnStats').onclick = () => {
  if (state === 'play') togglePause();
  BP.sheet(`<h2>Record</h2>
    <div class="stats-grid"><div class="stat"><b>${best.score}</b><span>Miglior punteggio</span></div><div class="stat"><b>${best.level}</b><span>Livello massimo</span></div><div class="stat"><b>${played}</b><span>Partite</span></div></div>
    <button class="danger" data-act="resetStats">Azzera record</button>
    <button class="primary" data-act="close">Chiudi</button>`);
};
$('btnHelp').onclick = () => {
  if (state === 'play') togglePause();
  BP.sheet(`<h2>Come si gioca</h2><ul class="rules">
    <li>Guida <b>Bip</b> con uno swipe o con le frecce. Puoi indicare la svolta prima dell'incrocio: Bip girerà appena possibile.</li>
    <li>Semino: 10 punti. <b>Cuore</b>: 50 punti, e i Brontoli diventano azzurri e scappano.</li>
    <li>Mangiare i Brontoli azzurri vale 200, 400, 800, 1600 punti di fila.</li>
    <li>Ogni livello ha un labirinto nuovo, mai visto prima. Hai 3 vite.</li></ul>
    <button class="primary" data-act="close">Ho capito</button>`);
};
BP.onSheet(act => {
  if (act === 'resetStats' && confirm('Azzerare i record?')) { best = { score: 0, level: 0 }; played = 0; store.set('bp.labirinto.best', best); store.set('bp.labirinto.played', 0); BP.closeSheet(); }
});
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); renderMazeLayer(); if (!running) draw(); });

readColors();
M = genMaze(); dots = new Map(); E = []; P = actor(M.start[0], M.start[1], 'left');
resize();
menu();
draw();
BP.registerSW();
window.__game = { genMaze, get state() { return { state, P, E, dots, score, lives, level, M }; } };
})();
