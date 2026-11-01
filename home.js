(() => {
'use strict';
const get = k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const num = v => Number.isFinite(v) ? v : 0;
const sumWon = s => s && typeof s === 'object' ? Object.values(s).reduce((a, x) => a + num(x && x.won), 0) : 0;
const inProgress = g => g && !g.done;

const ART = {
  sudoku: `<svg viewBox="0 0 90 90"><rect x="3" y="3" width="84" height="84" rx="8" class="a-paper" stroke="currentColor" stroke-width="3" style="stroke:var(--line-strong)"/>
    <path d="M31 3v84M59 3v84M3 31h84M3 59h84" class="a-line" stroke-width="2.5"/>
    <text x="17" y="24" font-size="17" font-weight="700" text-anchor="middle" class="a-ink">5</text>
    <text x="45" y="52" font-size="17" font-weight="700" text-anchor="middle" class="a-acc">9</text>
    <text x="73" y="80" font-size="17" font-weight="700" text-anchor="middle" class="a-ink">3</text>
    <text x="73" y="24" font-size="17" font-weight="700" text-anchor="middle" class="a-user">7</text></svg>`,
  nonogram: `<svg viewBox="0 0 90 90">${(() => {
      const heart = ['01010','11111','11111','01110','00100']; let s = '';
      heart.forEach((row, r) => [...row].forEach((c, k) => {
        s += `<rect x="${18 + k * 14}" y="${18 + r * 14}" width="12" height="12" rx="2" class="${c === '1' ? 'a-acc' : 'a-soft'}"/>`;
      }));
      return s;
    })()}</svg>`,
  calcudoku: `<svg viewBox="0 0 90 90"><rect x="3" y="3" width="84" height="84" rx="8" class="a-paper" style="stroke:var(--line-strong)" stroke-width="3"/>
    <path d="M45 3v42H87M3 45h42v42M45 66h42" class="a-line" stroke-width="3" fill="none"/>
    <text x="9" y="17" font-size="11" font-weight="800" class="a-acc">7+</text>
    <text x="51" y="17" font-size="11" font-weight="800" class="a-acc">2÷</text>
    <text x="51" y="59" font-size="11" font-weight="800" class="a-acc">12×</text>
    <text x="24" y="34" font-size="17" font-weight="700" class="a-user" text-anchor="middle">3</text>
    <text x="66" y="37" font-size="17" font-weight="700" class="a-user" text-anchor="middle">4</text></svg>`,
  takuzu: `<svg viewBox="0 0 90 90">${(() => {
      const g = ['1001','0110','1010','0101']; let s = '';
      g.forEach((row, r) => [...row].forEach((c, k) => {
        s += `<circle cx="${18 + k * 18}" cy="${18 + r * 18}" r="7.5" class="${c === '1' ? 'a-acc' : 'a-ink'}"/>`;
      }));
      return s;
    })()}</svg>`,
  stelle: `<svg viewBox="0 0 90 90"><rect x="3" y="3" width="84" height="84" rx="8" class="a-paper" style="stroke:var(--line-strong)" stroke-width="3"/>
    <path d="M3 31h28v28h28V3M59 59h28M31 59v28" class="a-line" stroke-width="3" fill="none"/>
    <path d="M17 7l3.2 6.6 7.2 1-5.2 5 1.2 7.2L17 23.4l-6.4 3.4 1.2-7.2-5.2-5 7.2-1z" class="a-acc"/>
    <path d="M73 35l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5 7.2-1z" class="a-acc"/>
    <path d="M45 63l3.2 6.6 7.2 1-5.2 5 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5 7.2-1z" class="a-acc"/></svg>`,
  parole: `<svg viewBox="0 0 110 70">${['L','O','G','I','C'].map((c, k) =>
      `<rect x="${3 + k * 21}" y="18" width="18" height="22" rx="4" class="${k === 1 ? 'a-ok' : k === 3 ? 'a-acc' : 'a-soft'}"/>
       <text x="${12 + k * 21}" y="34" font-size="13" font-weight="800" text-anchor="middle" fill="${k === 1 || k === 3 ? '#fff' : 'currentColor'}" style="${k === 1 || k === 3 ? '' : 'fill:var(--ink)'}">${c}</text>`).join('')}
      ${[0,1,2,3,4].map(k => `<rect x="${3 + k * 21}" y="44" width="18" height="22" rx="4" fill="none" style="stroke:var(--line)" stroke-width="2"/>`).join('')}</svg>`,
  snake: `<svg viewBox="0 0 90 90">${[[2,5],[3,5],[4,5],[5,5],[5,4],[5,3],[4,3],[3,3],[3,2]].map(([x, y], k) =>
      `<rect x="${x * 12 + 2}" y="${y * 12 + 2}" width="11" height="11" rx="3" class="a-ok" opacity="${0.45 + k * 0.06}"/>`).join('')}
      <circle cx="74" cy="20" r="5" class="a-acc"/><circle cx="41" cy="31" r="1.6" fill="#fff"/></svg>`,
  labirinto: `<svg viewBox="0 0 90 90"><path d="M8 8h74v74H8zM8 30h22M52 8v22h14M30 52h30v18M30 52V70M66 52h16" fill="none" style="stroke:var(--user)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${[[19,19],[41,19],[19,41],[41,41],[74,41],[19,62],[48,62]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" class="a-ink"/>`).join('')}
      <circle cx="74" cy="20" r="5" class="a-acc"/>
      <rect x="60" y="56" width="16" height="16" rx="5" class="a-acc"/><circle cx="65" cy="63" r="2" fill="#fff"/><circle cx="71" cy="63" r="2" fill="#fff"/></svg>`,
  campominato: `<svg viewBox="0 0 90 90">${[0,1,2,3].map(r=>[0,1,2,3].map(c=>`<rect x="${9+c*19}" y="${9+r*19}" width="17" height="17" rx="4" class="${(r+c)%3===0?'a-soft':'a-paper'}"/>`).join('')).join('')}
      <text x="36" y="42" font-size="13" font-weight="900" fill="#3b6fd4" text-anchor="middle">1</text><text x="55" y="61" font-size="13" font-weight="900" fill="#3f8f5a" text-anchor="middle">2</text>
      <circle cx="74" cy="33" r="6" fill="#2a2440"/><path d="M77 27l3-3" stroke="#2a2440" stroke-width="2"/><circle cx="81" cy="23" r="2" fill="#f2b705"/>
      <path d="M17 66V54" stroke="#2a2440" stroke-width="2"/><path d="M18 54h9l-2 3 2 3h-9z" fill="#e2725b"/></svg>`,
  flow: `<svg viewBox="0 0 90 90"><rect x="8" y="8" width="74" height="74" rx="10" class="a-paper"/>
      <path d="M22 22h46v20" fill="none" stroke="#e2725b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 40v28h26" fill="none" stroke="#5b8de2" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M40 46v4M68 60v8" fill="none" stroke="#58b37a" stroke-width="8" stroke-linecap="round"/>
      ${[[22,22,'#e2725b'],[68,42,'#e2725b'],[22,40,'#5b8de2'],[48,68,'#5b8de2'],[68,60,'#58b37a'],[68,68,'#58b37a']].map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`).join('')}</svg>`,
  luci: `<svg viewBox="0 0 90 90">${[0,1,2].map(r=>[0,1,2].map(c=>{const on=[1,3,4,5,7].includes(r*3+c);return `<rect x="${12+c*23}" y="${12+r*23}" width="19" height="19" rx="6" fill="${on?'#ffd257':'currentColor'}" style="${on?'':'color:var(--btn-hi)'}"/>`}).join('')).join('')}</svg>`,
  hanoi: `<svg viewBox="0 0 90 70"><rect x="6" y="58" width="78" height="5" rx="2.5" class="a-ink" opacity=".7"/>
      ${[16,45,74].map(x=>`<rect x="${x-1.5}" y="16" width="3" height="42" rx="1.5" style="fill:var(--line)"/>`).join('')}
      <rect x="4" y="50" width="24" height="7" rx="3.5" fill="#6a8fe0"/><rect x="7" y="42" width="18" height="7" rx="3.5" fill="#7cc08a"/>
      <rect x="35" y="50" width="20" height="7" rx="3.5" fill="#f2c94c"/><rect x="68" y="50" width="12" height="7" rx="3.5" fill="#e2725b"/></svg>`,
  '2048': `<svg viewBox="0 0 90 90"><rect x="8" y="8" width="74" height="74" rx="12" style="fill:var(--btn-hi)"/>
      ${[[0,0,'2','#f3e7d9','#6b5b4b'],[1,0,'8','#f6b37f','#fff'],[1,1,'64','#ec5f45','#fff'],[0,1,'4','#f0dcc0','#6b5b4b']].map(([c,r,t,bg,fg])=>`<rect x="${14+c*32}" y="${14+r*32}" width="29" height="29" rx="7" fill="${bg}"/><text x="${28.5+c*32}" y="${34+r*32}" font-size="${t.length>1?13:16}" font-weight="900" fill="${fg}" text-anchor="middle">${t}</text>`).join('')}</svg>`,
  memory: `<svg viewBox="0 0 100 80"><g transform="rotate(-8 30 40)"><rect x="12" y="14" width="34" height="48" rx="7" fill="#f9b4c4"/><rect x="17" y="19" width="24" height="38" rx="4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></g>
      <g transform="rotate(7 66 40)"><rect x="50" y="14" width="34" height="48" rx="7" class="a-paper" style="stroke:var(--line)" stroke-width="1.5"/><path d="M67 50s-10-6-10-13a5.5 5.5 0 0 1 10-3.2 5.5 5.5 0 0 1 10 3.2c0 7-10 13-10 13z" fill="#e2725b"/></g></svg>`,
  solitario: `<svg viewBox="0 0 100 80"><g transform="rotate(-10 34 44)"><rect x="18" y="16" width="34" height="48" rx="5" fill="#fffdf8" stroke="#d6cfc0"/><text x="24" y="30" font-size="11" font-weight="900" fill="#2a2440">K</text><path d="M35 34C33 37 29 39 29 42a3 3 0 0 0 5.2 2l-.7 4h3l-.7-4A3 3 0 0 0 41 42c0-3-4-5-6-8z" fill="#2a2440"/></g>
      <g transform="rotate(8 62 44)"><rect x="46" y="16" width="34" height="48" rx="5" fill="#fffdf8" stroke="#d6cfc0"/><text x="52" y="30" font-size="11" font-weight="900" fill="#d64545">A</text><path d="M63 50s-8-5-8-11a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 6-8 11-8 11z" fill="#d64545"/></g></svg>`
};

const TINT = { sudoku: '--t-peach', nonogram: '--t-pink', calcudoku: '--t-blue', takuzu: '--t-apri', stelle: '--t-yellow', parole: '--t-mint', snake: '--t-sky', labirinto: '--t-lav',
  campominato: '--t-mint', flow: '--t-sky', luci: '--t-lav', hanoi: '--t-apri', '2048': '--t-yellow', memory: '--t-pink', solitario: '--t-mint' };
const GAMES = {
  logic: [
    { id: 'sudoku', name: 'Sudoku', desc: 'Il classico 9x9, quattro livelli.',
      meta: () => { const g = get('sudoku.game.v1'); if (inProgress(g)) return 'Partita in corso'; const w = sumWon(get('sudoku.stats.v1')); return w ? `${w} ${w === 1 ? 'risolto' : 'risolti'}` : ''; } },
    { id: 'nonogram', name: 'Nonogram', desc: 'Colora le caselle e scopri il disegno.',
      meta: () => statMeta('nonogram', 'disegni') },
    { id: 'calcudoku', name: 'Calcudoku', desc: 'Sudoku con somme e prodotti.',
      meta: () => statMeta('calcudoku', 'risolti') },
    { id: 'takuzu', name: 'Takuzu', desc: 'Due colori, tre regole, pura logica.',
      meta: () => statMeta('takuzu', 'risolti') },
    { id: 'stelle', name: 'Stelle', desc: 'Una stella per riga, colonna e zona.',
      meta: () => statMeta('stelle', 'risolti') },
    { id: 'campominato', name: 'Campo minato', desc: 'Senza mai tirare a indovinare.',
      meta: () => { const g = get('bp.campominato.game'); if (g && g.started && !g.done) return 'Partita in corso'; const w = sumWon(get('bp.campominato.stats')); return w ? `${w} ${w === 1 ? 'vinta' : 'vinte'}` : ''; } },
    { id: 'flow', name: 'Flow', desc: 'Collega i colori, riempi la griglia.',
      meta: () => statMeta('flow', 'risolti') },
    { id: 'luci', name: 'Lights Out', desc: 'Spegni tutte le luci.',
      meta: () => statMeta('luci', 'risolti') },
    { id: 'hanoi', name: 'Torre di Hanoi', desc: 'Sposta la torre, un disco alla volta.',
      meta: () => statMeta('hanoi', 'torri') }
  ],
  relax: [
    { id: 'memory', name: 'Memory', desc: 'Trova tutte le coppie.',
      meta: () => statMeta('memory', 'partite vinte') },
    { id: 'solitario', name: 'Solitario', desc: 'Il classico con le carte.',
      meta: () => statMeta('solitario', 'vinti') }
  ],
  words: [
    { id: 'parole', name: 'Parole', desc: 'Indovina la parola in sei tentativi.',
      meta: () => { const s = get('bp.parole.stats'); const g = get('bp.parole.game');
        if (g && !g.done && g.guesses && g.guesses.length) return 'Partita in corso';
        return s && s.won ? `${s.won} ${s.won === 1 ? 'indovinata' : 'indovinate'}${s.streak > 1 ? ` · serie ${s.streak}` : ''}` : ''; } }
  ],
  arcade: [
    { id: 'snake', name: 'Snake', desc: 'Mangia, cresci, non morderti.',
      meta: () => { const b = get('bp.snake.best'); return b && b.score ? `Record ${b.score}` : ''; } },
    { id: '2048', name: '2048', desc: 'Unisci i numeri fino a 2048.',
      meta: () => { const b = get('bp.2048.best'); return b && num(b.score) ? `Record ${num(b.score)}` : ''; } },
    { id: 'labirinto', name: 'Labirinto', desc: 'Raccogli i punti, sfuggi alle ombre.',
      meta: () => { const b = get('bp.labirinto.best'); return b && b.score ? `Record ${b.score}` : ''; } }
  ]
};
function statMeta(id, word) {
  const g = get(`bp.${id}.game`);
  if (inProgress(g)) return 'Partita in corso';
  const w = sumWon(get(`bp.${id}.stats`));
  return w ? `${w} ${w === 1 ? (SINGULAR[word] || word) : word}` : '';
}
const SINGULAR = { disegni: 'disegno', risolti: 'risolto', torri: 'torre', 'partite vinte': 'partita vinta', vinti: 'vinto', vinte: 'vinta', indovinate: 'indovinata' };

const CHIP = { logic: 'Logica', words: 'Parole', relax: 'Relax', arcade: 'Arcade' };
const box = document.getElementById('cards');
const running = new Set();
const all = Object.entries(GAMES).flatMap(([section, list]) => list.map(g => ({ ...g, section })));
box.innerHTML = all.map(g => `<a class="card" href="${g.id}/" data-cat="${g.section}" data-id="${g.id}">
    <div class="art" aria-hidden="true" style="--tint:var(${TINT[g.id]})">${ART[g.id]}</div>
    <span class="chip c-${g.section}">${CHIP[g.section]}</span>
    <h3>${g.name}</h3><p>${g.desc}</p>
    <div class="meta idle" data-meta="${g.id}"><i></i><span>Da provare</span></div>
  </a>`).join('');
// i dati salvati vanno nel testo, mai nell'HTML
for (const g of all) {
  let meta = '';
  try { meta = String(g.meta() || ''); } catch { meta = ''; }
  if (!meta) continue;
  if (meta === 'Partita in corso') running.add(g.id);
  const el = box.querySelector(`[data-meta="${g.id}"]`);
  el.classList.remove('idle');
  el.lastElementChild.textContent = meta;
}

/* ============ Ultimi giocati ============ */
const recent = (() => {
  const r = get('bp.recent'), out = {};
  if (r && typeof r === 'object') for (const g of all) if (Number.isFinite(r[g.id])) out[g.id] = r[g.id];
  return out;
})();
function ago(ts) {
  const day = 86400000, start = new Date(); start.setHours(0, 0, 0, 0);
  if (ts >= start.getTime()) return 'oggi';
  if (ts >= start.getTime() - day) return 'ieri';
  const n = Math.ceil((start.getTime() - ts) / day);
  return n < 30 ? `${n} giorni fa` : 'tempo fa';
}
for (const g of all) {
  if (!recent[g.id]) continue;
  const el = box.querySelector(`[data-meta="${g.id}"]`);
  if (el.classList.contains('idle')) { el.classList.remove('idle'); el.lastElementChild.textContent = `Giocato ${ago(recent[g.id])}`; }
  else el.lastElementChild.textContent += ` · ${ago(recent[g.id])}`;
}
let sort = (() => { try { return localStorage.getItem('bp.home.sort') === 'type' ? 'type' : 'recent'; } catch { return 'recent'; } })();
const SORT_ICON = {
  recent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>'
};
function applySort() {
  const order = all.map((g, k) => ({ id: g.id, k, t: recent[g.id] || 0 }));
  if (sort === 'recent') order.sort((a, b) => (b.t - a.t) || (a.k - b.k));
  const emptyEl = document.getElementById('empty');
  for (const o of order) box.insertBefore(box.querySelector(`[data-id="${o.id}"]`), emptyEl);
  const btn = document.getElementById('sortBtn');
  btn.innerHTML = SORT_ICON[sort] + (sort === 'recent' ? 'Recenti' : 'Per tipo');
  btn.setAttribute('aria-label', sort === 'recent' ? 'Ordine: ultimi giocati. Tocca per ordinare per tipo' : 'Ordine: per tipo. Tocca per ordinare per ultimi giocati');
}

/* ============ Filtro per categoria ============ */
const FILTERS = [['all', 'Tutti'], ['running', 'In corso'], ['logic', 'Logica'], ['words', 'Parole'], ['relax', 'Relax'], ['arcade', 'Arcade']];
const count = f => f === 'all' ? all.length : f === 'running' ? running.size : all.filter(g => g.section === f).length;
let filter = (() => { try { return localStorage.getItem('bp.home.filter') || 'all'; } catch { return 'all'; } })();
if (!FILTERS.some(([k]) => k === filter) || count(filter) === 0) filter = 'all';
const bar = document.getElementById('filters');
bar.innerHTML = FILTERS.map(([k, label]) =>
  `<button role="tab" data-f="${k}" ${count(k) ? '' : 'disabled'}>${label}<b>${count(k)}</b></button>`).join('');
box.insertAdjacentHTML('beforeend', '<p class="empty" id="empty">Nessun gioco qui.</p>');
function applyFilter(animate) {
  bar.querySelectorAll('button').forEach(btn => {
    const on = btn.dataset.f === filter;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  let shown = 0;
  box.querySelectorAll('.card').forEach(c => {
    const vis = filter === 'all' || (filter === 'running' ? running.has(c.dataset.id) : c.dataset.cat === filter);
    c.classList.toggle('hide', !vis);
    if (vis) shown++;
  });
  document.getElementById('empty').classList.toggle('show', !shown);
  if (animate) { box.classList.remove('fade'); void box.offsetWidth; box.classList.add('fade'); }
}
bar.addEventListener('click', e => {
  const btn = e.target.closest('button[data-f]');
  if (!btn || btn.disabled) return;
  filter = btn.dataset.f;
  try { localStorage.setItem('bp.home.filter', filter); } catch { /* ignore */ }
  applyFilter(true);
  btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
});
applyFilter(false);
applySort();
document.getElementById('sortBtn').addEventListener('click', () => {
  sort = sort === 'recent' ? 'type' : 'recent';
  try { localStorage.setItem('bp.home.sort', sort); } catch { /* ignore */ }
  applySort(); applyFilter(true);
});
// ombra sotto la barra quando resta fissa in alto
if ('IntersectionObserver' in window) {
  const fb = document.getElementById('filterbar');
  new IntersectionObserver(([e]) => fb.classList.toggle('stuck', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(document.getElementById('sentinel'));
}
// cambiando filtro, se la barra è già fissa riporta in vista l'inizio della lista
bar.addEventListener('click', () => {
  const fb = document.getElementById('filterbar');
  if (fb.getBoundingClientRect().top <= 1) window.scrollTo({ top: box.offsetTop - fb.offsetHeight - 8, behavior: 'smooth' });
});

const d = new Date();
document.getElementById('today').innerHTML =
  `<b>${d.toLocaleDateString('it-IT', { weekday: 'long' })}</b>${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;

const net = document.getElementById('netState');
const setNet = () => { net.lastChild.textContent = navigator.onLine ? 'Pronta offline' : 'Stai giocando offline'; };
setNet();
window.addEventListener('online', setNet);
window.addEventListener('offline', setNet);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
