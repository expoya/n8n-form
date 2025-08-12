// js/ui/renderExpoList.js
import { state } from '../state.js';
import { startTextJob, pollTextJob } from '../api.js';
import { renderMarkdownToHtml } from '../render.js';
import { ladeFloskelnTexte } from './constants.js';
import { startLoading, stopLoading } from './loading.js';
import { ensureEditButton } from './edit.js';

export function renderExpoList () {
  const list = document.getElementById('expoList');
  list.innerHTML = '';

  // Safety: Gen-State initialisieren (falls noch nicht vorhanden)
  if (!state.gen) state.gen = {};

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
        <div class="generate-actions">
          <button class="btn btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
          <button class="btn btn-light btn-cancel-gen" data-idx="${idx}" style="display:none">Abbrechen</button>
        </div>
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

  // --- Text generieren (mit Abbrechen) ---
  list.querySelectorAll('.btn-generate-text').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      const idx = +btn.dataset.idx;
      if (Number.isNaN(idx)) return;

      // Doppelstart verhindern
      if (state.gen[idx]?.active) return;

      const container = btn.closest('.expo-akk-body');
      const preview   = container?.querySelector('.text-preview');
      const cancelBtn = container?.querySelector(`.btn-cancel-gen[data-idx="${idx}"]`);

      // UI vorbereiten
      const oldLabel  = btn.textContent;
      btn.disabled    = true;
      btn.textContent = '⏳ …';
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
      if (preview) startLoading(preview, ladeFloskelnTexte);

      // State für diesen Index setzen
      state.gen[idx] = {
        active   : true,
        cancelled: false,
        timer    : null,
        abortCtrl: (typeof AbortController !== 'undefined') ? new AbortController() : null
      };

      // Cancel-Handler binden (idempotent)
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          const g = state.gen[idx];
          if (!g || !g.active) return;
          g.cancelled = true;

          // Timer stoppen
          if (g.timer) { clearTimeout(g.timer); g.timer = null; }

          // Laufenden Request abbrechen (wenn möglich)
          if (g.abortCtrl) {
            try { g.abortCtrl.abort(); } catch (_) {}
          }

          // UI: Loader aus, Hinweis rein
          if (preview) {
            stopLoading(preview);
            preview.innerHTML = `<div class="text-warning">Vorgang abgebrochen.</div>`;
          }

          // Buttons zurücksetzen
          btn.disabled = false;
          btn.textContent = oldLabel;
          cancelBtn.style.display = 'none';

          // State zurücksetzen
          state.gen[idx].active = false;
        };
      }

      // Payload für Starter
      const payload = {
        ...state.companyData,
        h1Title: state.titles[idx],
        expoIdx: idx
      };

      try {
        // 1) Job starten
        // (startTextJob kann ohne signal bleiben; falls du es erweitert hast, signal mitgeben)
        const start = await startTextJob({ ...payload, title: state.titles[idx] }, state.gen[idx].abortCtrl?.signal);
        let jobId = (start?.jobId || '').toString().replace(/^=+/, '');
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Polling (mit Cancel)
        const maxTries = 90; // 90 * 10s = 15 min
        let tries = 0;

        const pollOnce = async () => {
          const g = state.gen[idx];
          if (!g || g.cancelled) return; // sauber beendet

          let job;
          try {
            // Dein pollTextJob behält Cache-Buster & no-store — wir geben nur optional das signal mit
            job = await pollTextJob(jobId, g.abortCtrl?.signal);
          } catch (pollErr) {
            // Bei manuellem Abbruch hier raus
            if (state.gen[idx]?.cancelled) return;

            // Netz-/Fetch-Fehler -> kurzer Retry
            g.timer = setTimeout(pollOnce, 1500);
            return;
          }

          const data   = Array.isArray(job) ? job[0] : job;
          const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
          const raw    = (data?.Text ?? '').trim();
          const html   = data?.Text ?? '';

          // --- A) Sofort-Text vorhanden
          if (raw) {
            const safeHtml = renderMarkdownToHtml(raw);
            state.texts[idx] = safeHtml;
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = safeHtml;
              ensureEditButton(preview, idx);
            }
            btn.remove();                               // Generate-Button wie bisher entfernen
            if (cancelBtn) cancelBtn.style.display = 'none';
            state.gen[idx].active = false;
            return;
          }

          // --- B) Über Status als fertig markiert
          if (['finished','completed','done','ready','success'].includes(status)) {
            const safeHtml2 = renderMarkdownToHtml(html || '');
            state.texts[idx] = safeHtml2 || '';
            if (preview) {
              stopLoading(preview);
              preview.innerHTML = safeHtml2 || '<em>Kein Text zurückgegeben.</em>';
              ensureEditButton(preview, idx);
            }
            btn.remove();
            if (cancelBtn) cancelBtn.style.display = 'none';
            state.gen[idx].active = false;
            return;
          }

          // --- C) Fehlerstatus
          if (['error','failed','fail'].includes(status)) {
            throw new Error('Text-Generierung fehlgeschlagen.');
          }

          // --- D) Weiter pollen (pending/running)
          tries++;
          if (tries > maxTries) throw new Error('Text-Generierung Timeout.');
          g.timer = setTimeout(pollOnce, 10_000);
        };

        await pollOnce();

      } catch (err) {
        // Nur zeigen, wenn nicht manuell abgebrochen
        if (!state.gen[idx]?.cancelled) {
          alert('Text-Webhook Fehler: ' + (err?.message || err));
          if (preview) {
            stopLoading(preview);
            preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
          }
          btn.disabled = false;
          btn.textContent = oldLabel;
          if (container) {
            const cBtn = container.querySelector(`.btn-cancel-gen[data-idx="${idx}"]`);
            if (cBtn) cBtn.style.display = 'none';
          }
        }
      } finally {
        // Aufräumen der Timer/Controller (ohne UI zu überschreiben, das macht der Flow oben)
        const g = state.gen[idx];
        if (g) {
          if (g.timer) { clearTimeout(g.timer); g.timer = null; }
          g.abortCtrl = null;
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
