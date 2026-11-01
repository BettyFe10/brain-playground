/* Brain Playground - impostazioni, backup e ripristino dei progressi.
   Il backup è un file JSON che resta all'utente (File, iCloud Drive, ecc.): nessun server, funziona offline. */
(() => {
'use strict';
const { store } = BP;
const KEY_OK = k => /^(bp\.|sudoku\.)[\w.-]{1,60}$/.test(k) && k !== 'bp.lastBackup';
const MAX_BYTES = 2 * 1024 * 1024;
const DAY = 86400000;

/* ============ Raccolta dei dati salvati ============ */
function collect() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (KEY_OK(k)) data[k] = localStorage.getItem(k);
    }
  } catch { /* storage non disponibile */ }
  return data;
}
const hasProgress = () => Object.keys(collect()).some(k => /stats|best|played|game/.test(k));
const lastBackup = () => { const t = store.get('bp.lastBackup', 0); return Number.isFinite(t) ? t : 0; };
const fmtDate = t => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
function backupStatus() {
  const t = lastBackup();
  if (!t) return { text: 'Non hai ancora fatto un backup.', old: hasProgress() };
  const days = Math.floor((Date.now() - t) / DAY);
  return { text: `Ultimo backup: <b>${fmtDate(t)}</b>${days ? ` (${days} ${days === 1 ? 'giorno' : 'giorni'} fa)` : ' (oggi)'}.`, old: days > 30 };
}

/* ============ Esporta ============ */
async function exportBackup() {
  const payload = { app: 'brain-playground', version: 1, created: new Date().toISOString(), data: collect() };
  const json = JSON.stringify(payload);
  const name = `brain-playground-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // iPhone: il foglio di condivisione permette "Salva su File" (anche iCloud Drive) e funziona nell'app installata
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup Brain Playground' });
      done();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  // computer e browser senza condivisione di file: scarica il file
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  done();
  function done() {
    store.set('bp.lastBackup', Date.now());
    BP.toast('Backup creato');
    refresh();
  }
}

/* ============ Importa ============ */
function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json,text/plain';
  input.style.display = 'none';
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    input.remove();
    if (f) await importFile(f);
  });
  document.body.appendChild(input);
  input.click();
}
async function importFile(f) {
  if (f.size > MAX_BYTES) { BP.toast('File troppo grande: non sembra un backup'); return; }
  let payload;
  try { payload = JSON.parse(await f.text()); } catch { BP.toast('Questo file non è un backup valido'); return; }
  if (!payload || payload.app !== 'brain-playground' || typeof payload.data !== 'object' || !payload.data) {
    BP.toast('Questo file non è un backup di Brain Playground'); return;
  }
  // tiene solo chiavi dell'app con valori JSON validi: ogni gioco ricontrolla comunque i propri dati
  const clean = {};
  for (const [k, v] of Object.entries(payload.data)) {
    if (!KEY_OK(k) || typeof v !== 'string' || v.length > 500000) continue;
    try { JSON.parse(v); } catch { continue; }
    clean[k] = v;
  }
  const n = Object.keys(clean).length;
  if (!n) { BP.toast('Il backup è vuoto'); return; }
  const when = Date.parse(payload.created);
  const label = Number.isFinite(when) ? `del ${fmtDate(when)}` : '';
  if (!confirm(`Ripristinare il backup ${label}?\nI progressi attuali su questo dispositivo verranno sostituiti.`)) return;
  try {
    const existing = Object.keys(collect());
    existing.forEach(k => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(clean)) localStorage.setItem(k, v);
    store.set('bp.lastBackup', Number.isFinite(when) ? when : Date.now());
  } catch {
    BP.toast('Memoria del dispositivo piena: ripristino non riuscito'); return;
  }
  BP.toast('Progressi ripristinati');
  setTimeout(() => location.reload(), 700);
}

/* ============ Foglio impostazioni ============ */
const ICON_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>';
function openSettings() {
  const st = backupStatus();
  BP.sheet(`
    <h2>Impostazioni</h2>
    ${BP.switchRow('sound', 'Suoni', 'Effetti brevi durante il gioco. Su iPhone tacciono con l\'interruttore silenzioso.', BP.settings.sound)}
    <div class="section-title">Backup dei progressi</div>
    <div class="backup-box">
      <p>Partite, record e statistiche sono salvati solo su questo dispositivo. Con un backup li ritrovi se cambi telefono o se il browser cancella i dati.</p>
      <p style="margin-top:8px" class="${st.old ? 'warn' : ''}">${st.text}</p>
      <div class="backup-row">
        <button class="main" data-act="export">${ICON_UP}Crea backup</button>
        <button data-act="import">${ICON_DOWN}Ripristina</button>
      </div>
    </div>
    <p class="sub" style="margin-top:12px">Su iPhone scegli <b>Salva su File</b> e poi iCloud Drive: così il backup è al sicuro anche se perdi il telefono.</p>
    <button class="primary" data-act="close">Chiudi</button>`);
}
BP.onSheet((act, d, t) => {
  if (act === 'export') exportBackup();
  else if (act === 'import') pickFile();
  else if (act === 'toggle' && d.key === 'sound') {
    BP.settings.sound = !BP.settings.sound; BP.saveSettings();
    t.querySelector('.switch').classList.toggle('on', BP.settings.sound);
    if (BP.settings.sound) BP.sfx('good');
  }
});
function refresh() {
  const dot = document.getElementById('backupDot');
  if (dot) dot.hidden = !backupStatus().old;
  if (BP.sheetOpen() && document.querySelector('.backup-box')) openSettings();
}
const btn = document.getElementById('btnSettings');
if (btn) btn.addEventListener('click', openSettings);
refresh();
window.__backup = { collect, importFile, exportBackup };
})();
