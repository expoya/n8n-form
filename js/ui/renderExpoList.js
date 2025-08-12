// js/ui/renderExpoList.js
import { state } from '../state.js';
import { startTextJob, pollTextJob } from '../api.js';
import { renderMarkdownToHtml } from '../render.js';
import { ladeFloskelnTexte } from './constants.js';
import { startLoading, stopLoading } from './loading.js';
import { ensureEditButton } from './edit.js';

// Laufzeitstatus für Text-Jobs pro Index
if (!window.textJobs) window.textJobs = {}; // { [idx]: { running: bool, cancel: bool } }

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
        <button class="btn btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
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
// --- Text generieren ---
list.querySelectorAll('.btn-generate-text').forEach(btn => {
  btn.onclick = async e => {
    e.stopPropagation();
    const idx = +btn.dataset.idx;
    if (Number.isNaN(idx)) return;

    // Mehrfachstart verhindern
    if (window.textJobs[idx]?.running) return;
    window.textJobs[idx] = { running: true, cancel: false };

    // Button sperren + UI vorbereiten
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = '⏳ …';

    const preview = btn.closest('.expo-akk-body')?.querySelector('.text-preview');
    if (preview) startLoading(preview, ladeFloskelnTexte);

    // Abbrechen-Button einfügen/anzeigen
    let cancelBtn = btn.parentNode.querySelector('.btn-cancel-text');
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary btn-cancel-text';
      cancelBtn.textContent = 'Abbrechen';
      cancelBtn.style.marginLeft = '8px';
      btn.after(cancelBtn);
    }
    cancelBtn.style.display = 'inline-flex';
    cancelBtn.disabled = false;

    // Flag, damit wir im finally nicht doppelt an der UI rumpfuschen
    let wasCancelled = false;

    cancelBtn.onclick = () => {
      if (!window.textJobs[idx]) return;
      window.textJobs[idx].cancel = true;
      wasCancelled = true;

      // UI SOFORT umstellen:
      if (preview) {
        stopLoading(preview); // Timer beenden
        preview.innerHTML = '<div class="text-cancelled">⛔ Vorgang abgebrochen.</div>';
      }
      btn.disabled = false;
      btn.textContent = oldLabel;
      cancelBtn.remove();
    };

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
        // Cancel-Check unmittelbar am Loop-Beginn
        if (window.textJobs[idx]?.cancel) {
          // Alles bereits in onclick bereinigt
          window.textJobs[idx] = { running: false, cancel: false };
          return;
        }

        tries++;

        let job;
        try {
          job = await pollTextJob(jobId);
        } catch (pollErr) {
          console.debug('[pollText] fetch error:', pollErr?.message || pollErr);
          // Kurze Pause und weiter, es könnte nur ein temporärer Netzaussetzer sein
          await new Promise(r => setTimeout(r, 10_000));
          continue;
        }

        // Nochmals Cancel checken, falls während des fetch geklickt wurde
        if (window.textJobs[idx]?.cancel) {
          window.textJobs[idx] = { running: false, cancel: false };
          return;
        }

        const data   = Array.isArray(job) ? job[0] : job;
        const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
        const html   = (data?.Text ?? '').trim();

        // --- A) Sofort-Text vorhanden
        if (html) {
          const safeHtml = renderMarkdownToHtml(html);
          state.texts[idx] = safeHtml;
          if (preview) {
            stopLoading(preview);
            preview.innerHTML = safeHtml;
            ensureEditButton(preview, idx);
          }
          btn.remove();
          if (cancelBtn) cancelBtn.remove();
          window.textJobs[idx] = { running: false, cancel: false };
          return;
        }

        // --- B) Über Status als fertig markiert
        if (['finished','completed','done','ready','success'].includes(status)) {
          const safeHtml2 = renderMarkdownToHtml(data?.Text || '');
          state.texts[idx] = safeHtml2 || '';
          if (preview) {
            stopLoading(preview);
            preview.innerHTML = safeHtml2 || '<em>Kein Text zurückgegeben.</em>';
            ensureEditButton(preview, idx);
          }
          btn.remove();
          if (cancelBtn) cancelBtn.remove();
          window.textJobs[idx] = { running: false, cancel: false };
          return;
        }

        if (['error','failed','fail'].includes(status)) {
          throw new Error('Text-Generierung fehlgeschlagen.');
        }

        await new Promise(r => setTimeout(r, 10_000));
      }

      throw new Error('Text-Generierung Timeout.');
    } catch (err) {
      if (!wasCancelled) {
        alert('Text-Webhook Fehler: ' + (err?.message || err));
        if (preview) {
          stopLoading(preview);
          preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
        }
      }
    } finally {
      // Wenn nicht bereits in onclick gesäubert wurde
      if (!wasCancelled && document.body.contains(btn)) {
        btn.disabled = false;
        btn.textContent = oldLabel;
      }
      if (!wasCancelled && cancelBtn && document.body.contains(cancelBtn)) {
        cancelBtn.remove();
      }
      window.textJobs[idx] = { running: false, cancel: false };
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
}
