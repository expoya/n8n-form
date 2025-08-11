// js/ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';
import { renderMarkdownToHtml } from './render.js';

const ladeFloskelnTexte = [
  "Der SEO-Stratege kippt gerade einen Eimer voller Keywords über den Besprechungstisch.",
  "Der Mikro-Texter ruft: ‚Wir brauchen mehr Drama!‘ – und haut ein Ausrufezeichen rein.",
  "Der SEO-Veredler rückt jedes Komma mit der Pinzette zurecht.",
  "Der SEO-Auditor blättert nervös durch die Google-Richtlinien.",
  "Der Mikro-Texter tippt mit geschlossenen Augen – der Auditor murmelt: Mutig.",
  "Der Mikro-Texter hat gerade aus Versehen einen Reim geschrieben und ist jetzt sehr stolz.",
  "Der SEO-Veredler trägt den Text wie ein rohes Ei ins Korrekturbüro.",
  "Der Mikro-Texter jongliert drei Metaphern – eine fällt runter.“,
  "Der SEO-Stratege zeigt auf die Wand und sagt: ‚Da muss das Keyword hin.‘",
];

export function renderExpoList () {
  const list = document.getElementById('expoList');
  list.innerHTML = '';

  // --- Items rendern ---
  state.titles.forEach((titel, idx) => {
    const li = document.createElement('li');
    li.className = 'expo-akkordeon';
    li.innerHTML = `
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

  // --- Akkordeon-Button (nur der Pfeil) ---
  list.querySelectorAll('.btn-expand').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const acc = btn.closest('.expo-akkordeon');
      const isOpen = acc.classList.toggle('open');
      btn.textContent = isOpen ? '▲' : '▼';
    };
  });

  // --- Text generieren ---
  list.querySelectorAll('.btn-generate-text').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      if (Number.isNaN(idx)) return;

      // Button sperren + UI vorbereiten
      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = '⏳ …';

      const preview = btn.closest('.expo-akk-body')?.querySelector('.text-preview');
     if (preview) startLoading(preview);


      // Payload für Starter
      const payload = {
        ...state.companyData,
        h1Title: state.titles[idx],
        expoIdx: idx
      };

      try {
        // 1) Job starten
        const start = await startTextJob({ ...payload, title: state.titles[idx] });
        let jobId = (start?.jobId || '').toString().replace(/^=+/, '');
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Polling
        let tries = 0;
        const maxTries = 90; // 10 s * 90 = 15 min

        while (tries <= maxTries) {
          tries++;

          let job;
          try {
            job = await pollTextJob(jobId);
          } catch (pollErr) {
            console.debug('[pollText] fetch error:', pollErr?.message || pollErr);
            await new Promise(r => setTimeout(r, 10_000));
            continue;
          }

          const data = Array.isArray(job) ? job[0] : job;
          const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
          const html   = data?.Text ?? '';

          // --- A) Sofort-Text vorhanden
          const raw = (data?.Text ?? '').trim();
          if (raw) {
            const safeHtml = renderMarkdownToHtml(raw);
            state.texts[idx] = safeHtml;
            btn.remove();
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = safeHtml;
              ensureEditButton(preview, idx);
            }
            return;
          }

          // --- B) Über Status als fertig markiert
          if (['finished','completed','done','ready','success'].includes(status)) {
            const safeHtml2 = renderMarkdownToHtml(html || '');
            state.texts[idx] = safeHtml2 || '';
            btn.remove();
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = safeHtml2 || '<em>Kein Text zurückgegeben.</em>';
              ensureEditButton(preview, idx);
            }
            return;
          }
     
          if (['error','failed','fail'].includes(status)) {
            throw new Error('Text-Generierung fehlgeschlagen.');
          }

          await new Promise(r => setTimeout(r, 10_000));
        }

        throw new Error('Text-Generierung Timeout.');
      } catch (err) {
        alert('Text-Webhook Fehler: ' + (err?.message || err));
        btn.disabled = false;
        btn.textContent = oldLabel;
       if (preview) {
  stopLoading(preview);
  preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
}
      }
    };
  });

  // --- Header-Klick (komplette Zeile) ---
  list.querySelectorAll('.expo-akkordeon').forEach(acc => {
    acc.addEventListener('click', e => {
      if (e.target.closest('.expo-akk-header')) {
        const isOpen = acc.classList.toggle('open');
        const btnExpand = acc.querySelector('.btn-expand');
        if (btnExpand) btnExpand.textContent = isOpen ? '▲' : '▼';
      }
    });
  });

  // --- Titel bearbeiten (Inline) ---
  list.querySelectorAll('.btn-edit-title').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();

      const idx  = +btn.dataset.idx;
      const acc  = btn.closest('.expo-akkordeon');
      const span = acc.querySelector('.expo-titel-text');
      if (!span) return;

      const input = document.createElement('input');
      input.value = span.textContent;
      input.className = 'edit-inline';
      span.replaceWith(input);
      input.focus();

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '✔️';
      saveBtn.className   = 'btn-icon btn-save-inline';
      input.after(saveBtn);

      function commit () {
        const val = input.value.trim();
        if (val) state.titles[idx] = val;
        input.replaceWith(span);
        span.textContent = val || span.textContent;
        saveBtn.remove();
      }

      saveBtn.onclick = commit;
      input.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } };
      input.onblur = commit;
    };
  });

  // --- Titel löschen ---
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      state.titles.splice(idx, 1);
      state.texts.splice(idx, 1);
      renderExpoList();
    };
  });

  // ===== Editiermodus (Text) =====
function startEditMode(preview, idx) {
  const currentHtml = state.texts[idx] || preview.innerHTML;

  // HTML → Plaintext
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = currentHtml;
  const plainText = tempDiv.textContent;

  // existierenden Edit-Button verstecken
  const container = preview.parentNode;
  const editBtn = container.querySelector(`.edit-btn[data-idx="${idx}"]`);
  if (editBtn) editBtn.style.display = 'none';

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.value = plainText;
  textarea.className = 'edit-textarea';

  // Aktionen
  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Speichern';
  saveBtn.className = 'btn btn-primary';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'btn btn-secondary';

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  // Preview ausblenden & Edit-UI einsetzen
  preview.style.display = 'none';
  container.insertBefore(textarea, preview);
  container.insertBefore(actions, preview);

  // Aktionen binden
  saveBtn.addEventListener('click', () => {
    const newHtml = renderMarkdownToHtml(textarea.value);
    state.texts[idx] = newHtml;
    preview.innerHTML = newHtml;
    cleanupEditMode(preview, textarea, actions, idx);
  });

  cancelBtn.addEventListener('click', () => {
    cleanupEditMode(preview, textarea, actions, idx);
  });
}

function cleanupEditMode(preview, textarea, actions, idx) {
  textarea.remove();
  actions.remove();
  preview.style.display = '';
  // Edit-Button wieder anzeigen
  const editBtn = preview.parentNode.querySelector(`.edit-btn[data-idx="${idx}"]`);
  if (editBtn) editBtn.style.display = '';
}


  function ensureEditButton(preview, idx) {
    if (!preview) return;
    const container = preview.parentNode;
    if (container.querySelector(`.edit-btn[data-idx="${idx}"]`)) return;

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Bearbeiten';
    editBtn.className = 'edit-btn';
    editBtn.dataset.idx = idx;

    container.insertBefore(editBtn, preview.nextSibling);
    editBtn.addEventListener('click', () => startEditMode(preview, idx));
  }

  // === Export-Buttons nur zeigen, wenn mind. 1 Text existiert ===
const exportBtn    = document.getElementById('exportBtn');
const exportXmlBtn = document.getElementById('exportXmlBtn');

const hasAnyText = (state.texts || []).some(t => (t || '').trim() !== '');

if (hasAnyText) {
  if (exportBtn)    exportBtn.style.display = 'inline-block';
  if (exportXmlBtn) exportXmlBtn.style.display = 'inline-block';
} else {
  if (exportBtn)    exportBtn.style.display = 'none';
  if (exportXmlBtn) exportXmlBtn.style.display = 'none';
}

  function startLoading(preview) {
  if (!preview) return;

  // Grundgerüst (Spinner + Hinweis + Fun-Zeile)
  preview.innerHTML = `
    <div class="text-loading">
      <div class="loader"></div>
      <div>
        <div><strong>Text wird generiert …</strong></div>
        <div class="loading-sub">Dieser Vorgang dauert, je nach gewählten Experten, 4-8 Minuten.</div>
        <div class="loading-fun"></div>
      </div>
    </div>
  `;

  const funEl = preview.querySelector('.loading-fun');
  let i = 0;
  funEl.textContent = ladeFloskelnTexte[i % ladeFloskelnTexte.length];

  const intId = setInterval(() => {
    i++;
    funEl.textContent = ladeFloskelnTexte[i % ladeFloskelnTexte.length];
  }, 2500);

  // Timer-ID am Element merken, damit wir ihn später stoppen können
  preview.dataset.loadingTimer = String(intId);
}

function stopLoading(preview) {
  if (!preview) return;
  const id = Number(preview.dataset.loadingTimer || 0);
  if (id) clearInterval(id);
  delete preview.dataset.loadingTimer;
}


} // Ende renderExpoList()
