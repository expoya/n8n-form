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
    const exportBtn    = document.getElementById('exportBtn');
    const exportXmlBtn = document.getElementById('exportXmlBtn');
    const hasAnyText = (state.texts || []).some(t => (t || '').trim() !== '');
    if (exportBtn)    exportBtn.style.display    = hasAnyText ? 'inline-block' : 'none';
    if (exportXmlBtn) exportXmlBtn.style.display = hasAnyText ? 'inline-block' : 'none';
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
        <button class="btn btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
        <div class="text-preview"></div>
      </div>
    `;
    list.appendChild(li);

    // Falls bereits Text vorhanden → direkt anzeigen + Edit-Button sicherstellen
    const previewEl = li.querySelector('.text-preview');
    const existingHtml = (state.texts && state.texts[idx]) || '';
    if (existingHtml) {
      previewEl.innerHTML = existingHtml;
      ensureEditButton(previewEl, idx);
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

      let wasCancelled = false;
      cancelBtn.onclick = () => {
        if (!window.textJobs[idx]) return;
        window.textJobs[idx].cancel = true;
        wasCancelled = true;

        // UI sofort umstellen
        if (preview) {
          stopLoading(preview);
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
            window.textJobs[idx] = { running: false, cancel: false };
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
            }

            const retry = isRetryText(raw) || safeHtml.trim() === '';
            if (retry) {
              showRegenerate(btn);
