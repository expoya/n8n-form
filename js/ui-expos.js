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
    const idx   = +btn.dataset.idx;
    btn.disabled = true; btn.textContent = '⏳ …';

    /* Payload an Webhook */
    const payload = {
      ...state.companyData,
      h1Title: state.titles[idx],
      expoIdx: idx
    };

    try{
      const { html } = await generateText(payload);   // ↖ kommt aus api.js
      state.texts[idx] = html;
      btn.remove();     // Button ausblenden
      btn.closest('.expo-akk-body')
         .querySelector('.text-preview').innerHTML = html;
    }catch(err){
      alert("Text-Webhook Fehler: "+err.message);
      btn.disabled = false; btn.textContent = 'Text generieren';
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

  /* ---------- Text generieren (einfach, wie Titel-Polling) ---------- */
list.querySelectorAll('.btn-gen-text').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const idx   = +btn.dataset.idx;
    const title = state.titles[idx];

    // Zielbereich im Akkordeon (falls vorhanden)
    const content = list.querySelector(`.expo-akk-content[data-idx="${idx}"]`);
    if (content) content.innerHTML = '<div class="text-loading">Text wird generiert …</div>';

    try {
      // 1) Job starten
      const start = await startTextJob({ ...state.companyData, title });
      const jobId = start?.jobId;
      if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

      // 2) Polling (10s Interval, max. 90 Versuche – analog Titel)
      let tries = 0;
      const maxTries = 90;

      while (tries <= maxTries) {
        tries++;
        const job = await pollTextJob(jobId);

        if (job.status === 'finished') {
          const html = job.result || '';
          state.texts[idx] = html;
          if (content) content.innerHTML = html || '<em>Kein Text zurückgegeben.</em>';
          return;
        }
        if (job.status === 'error') {
          throw new Error('Text-Generierung fehlgeschlagen.');
        }
        await new Promise(r => setTimeout(r, 10_000));
      }

      throw new Error('Text-Generierung Timeout.');
    } catch (err) {
      if (content) content.innerHTML = `<div class="text-error">Fehler: ${err.message}</div>`;
    }
  });
});


/* ---------- Weitere Event-Handler (Delete, Edit …) später ergänzen ---------- */
}
