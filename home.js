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
      <rect x="60" y="56" width="16" height="16" rx="5" class="a-acc"/><circle cx="65" cy="63" r="2" fill="#fff"/><circle cx="71" cy="63" r="2" fill="#fff"/></svg>`
};

const TINT = { sudoku: '--t-peach', nonogram: '--t-pink', calcudoku: '--t-blue', takuzu: '--t-apri', stelle: '--t-yellow', parole: '--t-mint', snake: '--t-sky', labirinto: '--t-lav' };
const GAMES = {
  logic: [
    { id: 'sudoku', name: 'Sudoku', desc: 'Il classico 9x9, quattro livelli.',
      meta: () => { const g = get('sudoku.game.v1'); if (inProgress(g)) return 'Partita in corso'; const w = sumWon(get('sudoku.stats.v1')); return w ? `${w} risolti` : ''; } },
    { id: 'nonogram', name: 'Nonogram', desc: 'Colora le caselle e scopri il disegno.',
      meta: () => statMeta('nonogram', 'disegni') },
    { id: 'calcudoku', name: 'Calcudoku', desc: 'Sudoku con somme e prodotti.',
      meta: () => statMeta('calcudoku', 'risolti') },
    { id: 'takuzu', name: 'Takuzu', desc: 'Due colori, tre regole, pura logica.',
      meta: () => statMeta('takuzu', 'risolti') },
    { id: 'stelle', name: 'Stelle', desc: 'Una stella per riga, colonna e zona.',
      meta: () => statMeta('stelle', 'risolti') }
  ],
  words: [
    { id: 'parole', name: 'Parole', desc: 'Indovina la parola in sei tentativi.',
      meta: () => { const s = get('bp.parole.stats'); const g = get('bp.parole.game');
        if (g && !g.done && g.guesses && g.guesses.length) return 'Partita in corso';
        return s && s.won ? `${s.won} indovinate${s.streak > 1 ? ` · serie ${s.streak}` : ''}` : ''; } }
  ],
  arcade: [
    { id: 'snake', name: 'Snake', desc: 'Mangia, cresci, non morderti.',
      meta: () => { const b = get('bp.snake.best'); return b && b.score ? `Record ${b.score}` : ''; } },
    { id: 'labirinto', name: 'Labirinto', desc: 'Raccogli i punti, sfuggi alle ombre.',
      meta: () => { const b = get('bp.labirinto.best'); return b && b.score ? `Record ${b.score}` : ''; } }
  ]
};
function statMeta(id, word) {
  const g = get(`bp.${id}.game`);
  if (inProgress(g)) return 'Partita in corso';
  const w = sumWon(get(`bp.${id}.stats`));
  return w ? `${w} ${word}` : '';
}

const CHIP = { logic: 'Logica', words: 'Parole', arcade: 'Arcade' };
const box = document.getElementById('cards');
const all = Object.entries(GAMES).flatMap(([section, list]) => list.map(g => ({ ...g, section })));
box.innerHTML = all.map(g => `<a class="card" href="${g.id}/">
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
  const el = box.querySelector(`[data-meta="${g.id}"]`);
  el.classList.remove('idle');
  el.lastElementChild.textContent = meta;
}

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
