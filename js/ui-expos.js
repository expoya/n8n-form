// js/ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';
import { renderMarkdownToHtml } from './render.js';

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
      if (preview) preview.innerHTML = '<div class="text-loading">Text wird generiert …</div>';

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
        if (preview) preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
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

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = currentHtml;
    const plainText = tempDiv.textContent;

    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.className = 'edit-textarea';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Speichern';
    saveBtn.className = 'save-btn';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.className = 'cancel-btn';

    preview.style.display = 'none';

    preview.parentNode.insertBefore(textarea, preview);
    preview.parentNode.insertBefore(saveBtn, preview);
    preview.parentNode.insertBefore(cancelBtn, preview);

    saveBtn.addEventListener('click', () => {
      const newHtml = renderMarkdownToHtml(textarea.value);
      state.texts[idx] = newHtml;
      preview.innerHTML = newHtml;
      cleanupEditMode(preview, textarea, saveBtn, cancelBtn);
    });

    cancelBtn.addEventListener('click', () => {
      cleanupEditMode(preview, textarea, saveBtn, cancelBtn);
    });
  }

  function cleanupEditMode(preview, textarea, saveBtn, cancelBtn) {
    textarea.remove();
    saveBtn.remove();
    cancelBtn.remove();
    preview.style.display = '';
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

  // === Export-Buttons sichtbar machen / verstecken ===
  const exportBtn    = document.getElementById('exportBtn');
  const exportXmlBtn = document.getElementById('exportXmlBtn');

  if (state.titles.length > 0) {
    if (exportBtn)    exportBtn.style.display = 'inline-block';
    if (exportXmlBtn) exportXmlBtn.style.display = 'inline-block';
  } else {
    if (exportBtn)    exportBtn.style.display = 'none';
    if (exportXmlBtn) exportXmlBtn.style.display = 'none';
  }
} // Ende renderExpoList()
