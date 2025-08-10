// ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';

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

        // 2) Polling (10s × 90 ≈ 15 min)
        let tries = 0;
        const maxTries = 90;

        while (tries <= maxTries) {
          tries++;

          let job;
          try {
            job = await pollTextJob(jobId);
          } catch (pollErr) {
            // Netzwerk/Zwischenfehler -> kurz warten und weiter versuchen
            await new Promise(r => setTimeout(r, 10_000));
            continue;
          }

          // Debug (bei Bedarf in Prod deaktivieren)
          console.debug('[pollText] tick', tries, 'raw:', job);

          // Manche Endpoints liefern Arrays (z. B. Sheets-Row)
          const data = Array.isArray(job) ? job[0] : job;

          // Status flexibel lesen
          const status = (
            data?.status ??
            data?.Status ??
            data?.state ??
            data?.State ??
            data?.result?.status ??
            ''
          ).toString().toLowerCase();

          // HTML/Text aus gängigen Feldern ziehen
          const html =
            data?.result ??
            data?.html ??
            data?.HTML ??
            data?.text ??
            data?.body ??
            data?.payload?.html ??
            data?.payload?.result ??
            '';

          // Fall A: erkennbarer Fertig-Status
          if (['finished', 'completed', 'done', 'ready', 'success'].includes(status)) {
            state.texts[idx] = html || '';
            btn.remove(); // Button raus, wenn erledigt
            if (preview) preview.innerHTML = html || '<em>Kein Text zurückgegeben.</em>';
            return;
          }

          // Fall B: kein Status, aber Text/HTML vorhanden
          if (typeof html === 'string' && html.trim() !== '') {
            state.texts[idx] = html;
            btn.remove();
            if (preview) preview.innerHTML = html;
            return;
          }

          // Fall C: Fehlerstatus
          if (['error', 'failed', 'fail'].includes(status)) {
            throw new Error('Text-Generierung fehlgeschlagen.');
          }

          // Weiter warten
          await new Promise(r => setTimeout(r, 10_000));
        }

        // Timeout
        throw new Error('Text-Generierung Timeout.');
      } catch (err) {
        alert('Text-Webhook Fehler: ' + (err?.message || err));
        btn.disabled = false;
        btn.textContent = oldLabel;
        if (preview) {
          preview.innerHTML = `<div class="text-error">Fehler: ${err?.message || err}</div>`;
        }
      }
    };
  });

  // --- Header-Klick (komplette Zeile) öffnet/schließt ebenfalls ---
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
      input.onkeydown = ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      };
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
}
