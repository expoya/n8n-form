// ui-expos.js
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
      // Sichtbarkeit steuert CSS: .open .expo-akk-body { display:block; }
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
      if (preview) {
        preview.innerHTML = '<div class="text-loading">Text wird generiert …</div>';
      }

      // Payload für Starter
      const payload = {
        ...state.companyData,
        h1Title: state.titles[idx],
        expoIdx: idx
      };

      try {
        // 1) Job starten
        const start = await startTextJob({ ...payload, title: state.titles[idx] });
        let jobId = (start?.jobId || '').toString().replace(/^=+/, ''); // führende "=" entfernen
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Polling (angepasst an: Array[0] mit Feldern "Status" und "Text")
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

          // Dein Endpoint liefert ein Array mit genau 1 Row
          const data = Array.isArray(job) ? job[0] : job;
          console.debug('[pollText] tick', tries, data);

          // Status/HTML nach deinem Schema
          const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
          const html   = data?.Text ?? '';
