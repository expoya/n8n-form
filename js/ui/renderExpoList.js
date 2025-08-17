
import { state } from '../state.js';
import { startTextJob, pollTextJob } from '../api.js';
import { renderMarkdownToHtml } from '../render.js';
import { ladeFloskelnTexte } from './constants.js';
import { startLoading, stopLoading } from './loading.js';
import { ensureEditButton } from './edit.js';
import { notify, primeAudioOnUserGesture } from './notifier.js';

// Laufzeitstatus für Text-Jobs pro Index
if (!window.textJobs) window.textJobs = {}; // { [idx]: { running: bool, cancel: bool } }

export function renderExpoList () {
  const list = document.getElementById('expoList');
  list.innerHTML = '';

  // --- Helper lokal ---
  function isRetryText(s) {
    const t = (s || '').toLowerCase();
    return (
      t.includes('ich konnte keinen text generieren') ||
      t.includes('kein text zurückgegeben') ||
      t.includes('nochmal versuchen')
    );
  }

  function showRegenerate(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = 'Erneut generieren';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary', 'btn-regenerate-text');
  }

  function updateExportButtons() {
    const exportXmlBtn = document.getElementById('exportXmlBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const hasAnyText = (state.texts || []).some(t => (t || '').trim() !== '');
    const hasAnyTitle = (state.titles || []).length > 0;
    if (exportCsvBtn) exportCsvBtn.style.display = hasAnyTitle ? 'inline-block' : 'none';
    if (exportXmlBtn) exportXmlBtn.style.display = hasAnyText ? 'inline-block' : 'none';
  }

  // Kleine Badge im Header anzeigen, wenn Text vorhanden ist
  function markHasText(headerEl) {
    if (!headerEl) return;
    if (!headerEl.querySelector('.text-badge')) {
      const badge = document.createElement('span');
      badge.className = 'text-badge';
      badge.textContent = 'Text';
      const expandBtn = headerEl.querySelector('.btn-expand');
      headerEl.insertBefore(badge, expandBtn || null);
    }
    headerEl.closest('.expo-akkordeon')?.classList.add('has-text');
  }

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
        <div class="generate-row">
          <textarea
            class="briefing-input"
            id="briefing-${idx}"
            placeholder="Vorgaben & Ausschlüsse (optional) – z. B. ‚keine Rabatte nennen; CTA: Beratung; Fokus: Regionalität‘"
          ></textarea>
          <div class="btn-row">
            <button class="btn btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
            <button class="btn btn-outline btn-cancel-text" data-idx="${idx}" style="display:none">Abbrechen</button>
          </div>
          <div class="text-preview"></div>
        </div>
      </div>
    `;
    list.appendChild(li);

    // Falls bereits Text vorhanden → direkt anzeigen + Edit-Button sicherstellen
    const previewEl = li.querySelector('.text-preview');
    const existingHtml = (state.texts && state.texts[idx]) || '';
    if (existingHtml) {
      previewEl.innerHTML = existingHtml;
      ensureEditButton(previewEl, idx);
      markHasText(li.querySelector('.expo-akk-header'));
    }
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

  // --- Text generieren / erneut generieren ---
  list.querySelectorAll('.btn-generate-text, .btn-regenerate-text').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      primeAudioOnUserGesture?.(); // innerhalb User-Geste

      const idx = Number(btn.dataset.idx);
      if (!Number.isInteger(idx)) return;

      const titel = state.titles?.[idx] ?? '';
      if (!titel) {
        console.warn('[Text-Job] Kein Titel für idx', idx, state.titles);
        return;
      }

      // Mehrfachstart verhindern
      if (window.textJobs[idx]?.running) return;
      window.textJobs[idx] = { running: true, cancel: false };

      const acc     = btn.closest('.expo-akkordeon');
      const body    = acc?.querySelector('.expo-akk-body');
      const preview = body?.querySelector('.text-preview');
      const cancelBtn = body?.querySelector(`.btn-cancel-text[data-idx="${idx}"]`);

      // UI → Running
      btn.disabled = true;
      const oldLabel = btn.textContent;
      btn.textContent = '⏳ …';
      if (preview) startLoading(preview, ladeFloskelnTexte);

      // Cancel-Handler (falls Button existiert)
      if (cancelBtn) {
        cancelBtn.style.display = '';
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.onclick = () => {
          if (!window.textJobs[idx]) window.textJobs[idx] = {};
          window.textJobs[idx].cancel = true;
          cancelBtn.disabled = true;
          cancelBtn.textContent = 'Abbruch angefordert…';
        };
      }

      // Vorgaben & Ausschlüsse einsammeln
      const briefEl   = acc?.querySelector(`#briefing-${idx}`);
      const briefText = (briefEl?.value || '').trim();

      // Payload sauber bauen (agentModels hängt api.js ohnehin an)
      const payload = {
        ...state.companyData,
        h1Title: titel,
        expoIdx: idx,
        title:   titel,
        custom_brief: briefText
      };

      try {
        // 1) Job starten
        const start = await startTextJob(payload);
        let jobId = String(start?.jobId || '').replace(/^=+/, '');
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Polling
        let tries = 0;
        const maxTries = 90; // 10 s * 90 = 15 min

        while (tries <= maxTries) {
          // Cancel-Check unmittelbar am Loop-Beginn
          if (window.textJobs[idx]?.cancel) {
            window.textJobs[idx] = { running: false, cancel: false };
            // UI zurücksetzen
            btn.disabled = false;
            btn.textContent = oldLabel;
            if (preview) stopLoading(preview);
            if (cancelBtn) {
              cancelBtn.style.display = 'none';
              cancelBtn.disabled = false;
              cancelBtn.onclick = null;
            }
            return;
          }

          tries++;

          let job;
          try {
            job = await pollTextJob(jobId);
          } catch (pollErr) {
            console.debug('[pollText] fetch error:', pollErr?.message || pollErr);
            await new Promise(r => setTimeout(r, 10_000));
            continue;
          }

          // Nochmals Cancel checken, falls während fetch geklickt wurde
          if (window.textJobs[idx]?.cancel) {
            window.textJobs[idx] = { running: false, cancel: false };
            btn.disabled = false;
            btn.textContent = oldLabel;
            if (preview) stopLoading(preview);
            if (cancelBtn) {
              cancelBtn.style.display = 'none';
              cancelBtn.disabled = false;
              cancelBtn.onclick = null;
            }
            return;
          }

          const data   = Array.isArray(job) ? job[0] : job;
          const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
          const raw    = (data?.Text ?? '').trim();

          // --- A) Sofort-Text vorhanden
          if (raw) {
            const safeHtml = renderMarkdownToHtml(raw);
            state.texts[idx] = safeHtml;

            if (preview) {
              stopLoading(preview);
              preview.innerHTML = safeHtml;
              ensureEditButton(preview, idx);
              const t = (state.titles && state.titles[idx]) || `Titel #${idx+1}`;
              notify('Text fertig', `Der Text für „${t}“ ist da.`);
              markHasText(acc?.querySelector('.expo-akk-header'));
            }

            const retry = isRetryText(raw) || safeHtml.trim() === '';
            if (retry) {
              showRegenerate(btn);
              window.textJobs[idx] = { running: false, cancel: false };
            } else {
              btn.disabled = false;
              btn.textContent = oldLabel;
            }

            if (cancelBtn) {
              cancelBtn.style.display = 'none';
              cancelBtn.disabled = false;
              cancelBtn.onclick = null;
            }
            updateExportButtons();
            break; // fertig – Schleife verlassen
          }

          // --- B) Kein Text: Status auswerten ---
          if (status === 'error') {
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = '<div class="text-error">Fehler bei der Generierung.</div>';
            }
            btn.disabled = false;
            btn.textContent = oldLabel;
            if (cancelBtn) {
              cancelBtn.style.display = 'none';
              cancelBtn.disabled = false;
              cancelBtn.onclick = null;
            }
            window.textJobs[idx] = { running: false, cancel: false };
            break;
          }

          if (status === 'finished') {
            // Fertig, aber kein Text -> "Erneut generieren"
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = '<em>Kein Text zurückgegeben.</em>';
            }
            showRegenerate(btn);
            if (cancelBtn) {
              cancelBtn.style.display = 'none';
              cancelBtn.disabled = false;
              cancelBtn.onclick = null;
            }
            window.textJobs[idx] = { running: false, cancel: false };
            updateExportButtons();
            break;
          }

          // noch nicht fertig -> warten & weiter
          await new Promise(r => setTimeout(r, 10_000));
        } // while

        // --- Timeout-Absicherung ---
        if (tries > maxTries) {
          if (preview) {
            stopLoading(preview);
            preview.innerHTML = '<div class="text-error">Timeout – bitte erneut versuchen.</div>';
          }
          btn.disabled = false;
          btn.textContent = oldLabel;
          if (cancelBtn) {
            cancelBtn.style.display = 'none';
            cancelBtn.disabled = false;
            cancelBtn.onclick = null;
          }
          window.textJobs[idx] = { running: false, cancel: false };
        }
      } catch (err) {
        if (preview) {
          stopLoading(preview);
          preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
        }
        btn.disabled = false;
        btn.textContent = oldLabel;
        if (cancelBtn) {
          cancelBtn.style.display = 'none';
          cancelBtn.disabled = false;
          cancelBtn.onclick = null;
        }
        window.textJobs[idx] = { running: false, cancel: false };
      }
    };
  });

  // --- Titel bearbeiten ---
  list.querySelectorAll('.btn-edit-title').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      const header = btn.closest('.expo-akk-header');
      const titleSpan = header.querySelector('.expo-titel-text');
      const old = titleSpan?.textContent || '';

      const input = document.createElement('input');
      input.type = 'text';
      input.value = old;
      input.className = 'title-input';
      input.style.minWidth = '40%';
      titleSpan.replaceWith(input);

      const save = document.createElement('button');
      save.className = 'btn btn-primary btn-save-title';
      save.textContent = 'Speichern';

      const cancel = document.createElement('button');
      cancel.className = 'btn btn-secondary btn-cancel-title';
      cancel.textContent = 'Abbrechen';

      const controls = header.querySelector('.header-controls') || header.appendChild(document.createElement('span'));
      const oldControls = controls.innerHTML;
      controls.className = 'header-controls';
      controls.innerHTML = '';
      controls.append(save, cancel);

      const finish = () => {
        const span = document.createElement('span');
        span.className = 'expo-titel-text';
        span.textContent = state.titles[idx] || old;
        input.replaceWith(span);
        controls.innerHTML = oldControls || `
          <button class="btn-icon btn-edit-title" data-idx="${idx}" title="Bearbeiten">✏️</button>
          <button class="btn-icon btn-delete"      data-idx="${idx}" title="Entfernen">🗑️</button>
          <button class="btn-expand"               data-idx="${idx}" title="Details">▼</button>
        `;
      };

      save.onclick = () => {
        const v = (input.value || '').trim();
        if (!v) { input.focus(); return; }
        state.titles[idx] = v;
        finish();
      };
      cancel.onclick = () => finish();

      input.focus(); input.select();
    };
  });

  // --- Titel löschen ---
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      if (Number.isNaN(idx)) return;
      if (!confirm('Diesen Titel wirklich löschen?')) return;

      if (window.textJobs[idx]?.running) {
        alert('Bitte zuerst den laufenden Job abbrechen.');
        return;
      }

      state.titles.splice(idx, 1);
      if (Array.isArray(state.texts)) state.texts.splice(idx, 1);

      // Jobs neu indexieren
      const oldJobs = window.textJobs || {};
      const newJobs = {};
      Object.keys(oldJobs).forEach(k => {
        const i = Number(k);
        if (!Number.isInteger(i)) return;
        if (i < idx) newJobs[i]   = oldJobs[i];
        if (i > idx) newJobs[i-1] = oldJobs[i];
      });
      window.textJobs = newJobs;

      renderExpoList();
    };
  });

  // Export-Buttons initial passend setzen
  updateExportButtons();
}
```
