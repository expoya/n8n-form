import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';

export function renderExpoList(){
  const list=document.getElementById('expoList');//
  list.innerHTML="";
  state.titles.forEach((titel,idx)=>{
    const li=document.createElement('li');
    li.className="expo-akkordeon";//j
    li.innerHTML=`
     
  <div class="expo-akk-header" data-idx="${idx}">
    <span class="expo-akk-index">${idx + 1}.</span>
    <span class="expo-akk-titel"><span class="expo-titel-text">${titel}</span></span>
    <button class="btn-icon btn-edit-title" data-idx="${idx}" title="Bearbeiten">✏️</button>
    <button class="btn-icon btn-delete"      data-idx="${idx}" title="Entfernen">🗑️</button>
    <button class="btn-expand"               data-idx="${idx}" title="Details">▼</button>
  </div>

  <div class="expo-akk-body">
    <button class="btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
    <div class="text-preview"></div>
  </div>
`;

    list.appendChild(li);
  });

  /* ---------- Akkordeon öffnen / schließen ---------- */
list.querySelectorAll('.btn-expand').forEach(btn => {
  btn.onclick = e => {
  e.stopPropagation();
  const acc    = btn.closest('.expo-akkordeon');
  const isOpen = acc.classList.toggle('open');   // ⇄ auf/zu
  btn.textContent = isOpen ? '▲' : '▼';          // Pfeil anpassen
  // Anzeige übernimmt nun rein die CSS-Regel .open .expo-akk-body{display:block;}
};
});
/* ---------- Text generieren ---------- */
list.querySelectorAll('.btn-generate-text').forEach(btn=>{
  btn.onclick = async e => {
    e.stopPropagation();
    const idx = +btn.dataset.idx;
    btn.disabled = true; 
    btn.textContent = '⏳ …';

    // Zielbereich im Akkordeon
    const preview = btn.closest('.expo-akk-body')?.querySelector('.text-preview');
    if (preview) preview.innerHTML = '<div class="text-loading">Text wird generiert …</div>';

    // Payload an den Starter
    const payload = {
      ...state.companyData,
      h1Title: state.titles[idx],
      expoIdx: idx
    };

    try {
      // 1) Job starten (Job-ID holen)
      const start = await startTextJob({ ...payload, title: state.titles[idx] });
      let jobId = (start?.jobId || '').toString().replace(/^=+/, ''); // führende "=" entfernen
      if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

// 2) Polling (robust: verschiedene Status-/Feldnamen akzeptieren)
let tries = 0;
const maxTries = 90;

while (tries <= maxTries) {
  tries++;

  const job = await pollTextJob(jobId);
  console.debug('[pollText] raw:', job);

  // Falls der Poll-Endpoint ein Array liefert (z.B. 1 Row aus Sheets)
  const data = Array.isArray(job) ? job[0] : job;

  // Status robust normalisieren (Status, status, state, done, completed, ready, finished)
  const status = (
    data?.status ??
    data?.Status ??
    data?.state ??
    data?.State ??
    data?.result?.status ??
    ''
  ).toString().toLowerCase();

  // HTML/Text aus verschiedenen möglichen Feldern ziehen
  const html =
    data?.result ??
    data?.html ??
    data?.HTML ??
    data?.text ??
    data?.body ??
    data?.payload?.html ??
    data?.payload?.result ??
    '';

  // 1) Wenn Feld 'status' typische Fertig-Werte hat → fertig
  if (['finished', 'completed', 'done', 'ready', 'success'].includes(status)) {
    state.texts[idx] = html || '';
    btn.remove();
    if (preview) preview.innerHTML = html || '<em>Kein Text zurückgegeben.</em>';
    return;
  }

  // 2) Falls kein Status kommt, aber bereits HTML/Text vorhanden ist → ebenfalls fertig
  if (html && typeof html === 'string' && html.trim() !== '') {
    state.texts[idx] = html;
    btn.remove();
    if (preview) preview.innerHTML = html;
    return;
  }

  // 3) Fehlerstatus?
  if (['error', 'failed', 'fail'].includes(status)) {
    throw new Error('Text-Generierung fehlgeschlagen.');
  }

  // 10s warten und weiter pollen
  await new Promise(r => setTimeout(r, 10_000));
}


      throw new Error('Text-Generierung Timeout.');
    } catch (err) {
      alert('Text-Webhook Fehler: ' + err.message);
      btn.disabled = false; 
      btn.textContent = 'Text generieren';
      if (preview) preview.innerHTML = `<div class="text-error">Fehler: ${err.message}</div>`;
    }
  };
});



/* ---------- show/hide Body beim Akkordeon-Toggle ---------- */
list.querySelectorAll('.expo-akkordeon').forEach(acc => {
  acc.addEventListener('click', e => {
  if (e.target.closest('.expo-akk-header')) {
    const isOpen    = acc.classList.toggle('open');          // ⇄ auf/zu
    const btnExpand = acc.querySelector('.btn-expand');
    if (btnExpand) btnExpand.textContent = isOpen ? '▲' : '▼'; // Pfeil synchron halten
    // Keine weiteren Styles nötig – CSS steuert die Sichtbarkeit.
  }
});
});

/* ---------- Titel bearbeiten ---------- */
list.querySelectorAll('.btn-edit-title').forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();

    const idx   = btn.dataset.idx;
    const acc   = btn.closest('.expo-akkordeon');
    const span  = acc.querySelector('.expo-titel-text');

    // Eingabefeld
    const input = document.createElement('input');
    input.value = span.textContent;
    input.className = 'edit-inline';
    span.replaceWith(input);
    input.focus();

    // Save-Button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✔️';
    saveBtn.className   = 'btn-icon btn-save-inline';
    input.after(saveBtn);

    function commit(){
      const val = input.value.trim();
      if (val) state.titles[idx] = val;
      input.replaceWith(span);
      span.textContent = val || span.textContent;
      saveBtn.remove();
    }

    saveBtn.onclick    = commit;
    input.onkeydown    = ev => { if (ev.key === 'Enter'){ ev.preventDefault(); commit(); } };
    input.onblur       = commit;
  };
});

  /* ---------- Titel löschen ---------- */
list.querySelectorAll('.btn-delete').forEach(btn=>{
  btn.onclick = e => {
    e.stopPropagation();
    const idx = +btn.dataset.idx;
    state.titles.splice(idx, 1);     // Titel entfernen
    state.texts.splice(idx, 1);      // zugehörigen Text entfernen
    renderExpoList();                // Liste neu zeichnen
  };
});

/* ---------- Weitere Event-Handler (Delete, Edit …) später ergänzen ---------- */
}
