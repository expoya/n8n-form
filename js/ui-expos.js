// js/ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';
import { renderMarkdownToHtml } from './render.js';

// Laufzeitstatus für Text-Jobs pro Index
if (!window.textJobs) window.textJobs = {}; // { [idx]: { running: bool, cancel: bool } }

// ---------- kleine Utilities ----------
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function isRetryText(s) {
  const t = (s || '').toLowerCase();
  return (
    t.includes('ich konnte keinen text generieren') ||
    t.includes('kein text zurückgegeben') ||
    t.includes('nochmal versuchen') ||
    t.trim() === ''
  );
}

function setRunning(idx, running) {
  window.textJobs[idx] = { ...(window.textJobs[idx] || {}), running };
}

function setCancel(idx, cancel) {
  window.textJobs[idx] = { ...(window.textJobs[idx] || {}), cancel };
}

function makeSpinner() {
  const span = document.createElement('span');
  span.className = 'mini-spinner';
  span.textContent = '…';
  span.setAttribute('aria-busy', 'true');
  return span;
}

function showRegenerate(btn) {
  const wrap = btn.closest('.expo-actions');
  if (!wrap) return;
  const re = wrap.querySelector('.btn-regenerate');
  if (re) re.style.display = '';
}

function hideRegenerate(btn) {
  const wrap = btn.closest('.expo-actions');
  if (!wrap) return;
  const re = wrap.querySelector('.btn-regenerate');
  if (re) re.style.display = 'none';
}

function ensureEditButton(container, idx) {
  // Button nur hinzufügen, wenn Text existiert
  const hasText = (state.texts?.[idx] || '').trim() !== '';
  if (!hasText) return;

  const existing = container.querySelector('.btn-edit');
  if (existing) return;

  const b = document.createElement('button');
  b.className = 'btn btn-secondary btn-edit';
  b.textContent = 'Bearbeiten';
  b.addEventListener('click', () => enterEditMode(container, idx));
  container.appendChild(b);
}

function enterEditMode(container, idx) {
  const html = state.texts?.[idx] || '';
  const md = window.turndownService
    ? window.turndownService.turndown(html)
    : html; // Fallback: roh anzeigen

  container.innerHTML = `
    <textarea class="expo-edit" rows="10">${md}</textarea>
    <div class="edit-actions" style="margin-top:8px; display:flex; gap:8px;">
      <button class="btn btn-primary btn-save">Speichern</button>
      <button class="btn btn-secondary btn-cancel">Abbrechen</button>
    </div>
  `;

  const ta = container.querySelector('.expo-edit');
  const btnSave = container.querySelector('.btn-save');
  const btnCancel = container.querySelector('.btn-cancel');

  btnSave.onclick = () => {
    const newMd = ta.value || '';
    const safeHtml = renderMarkdownToHtml(newMd);
    state.texts[idx] = safeHtml;
    container.innerHTML = safeHtml;
    ensureEditButton(container, idx);
  };
  btnCancel.onclick = () => {
    container.innerHTML = html;
    ensureEditButton(container, idx);
  };
}

// ---------- Render der Liste ----------
export function renderExpoList() {
  const list = qs('#expoList');
  if (!list) return;

  list.innerHTML = '';
  const titles = state.titles || [];
  if (!state.texts || state.texts.length !== titles.length) {
    state.texts = new Array(titles.length).fill('');
  }

  if (titles.length === 0) {
    const li = document.createElement('li');
    li.className = 'expo-placeholder';
    li.textContent = 'Hier erscheinen deine generierten Expo-Titel…';
    list.appendChild(li);
    return;
  }

  titles.forEach((title, idx) => {
    const li = document.createElement('li');
    li.className = 'expo-akkordeon';
    li.innerHTML = `
      <div class="expo-akk-header" data-idx="${idx}">
        <span class="expo-akk-index">${idx + 1}.</span>
        <span class="expo-akk-titel"><span class="expo-titel-text">${title}</span></span>
      </div>

      <div class="expo-akk-body" data-idx="${idx}">
        <div class="expo-preview" data-idx="${idx}">
          ${(state.texts[idx] || '').trim() || '<em>Noch kein Text generiert.</em>'}
        </div>
        <div class="expo-actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-generate" data-idx="${idx}">Text generieren</button>
          <button class="btn btn-secondary btn-regenerate" data-idx="${idx}" style="display:none;">Neu generieren</button>
          <button class="btn btn-secondary btn-cancel" data-idx="${idx}" style="display:none;">Abbrechen</button>
        </div>
      </div>
    `;
    list.appendChild(li);

    // Edit-Button nur anzeigen, wenn ein Text da ist
    const preview = li.querySelector('.expo-preview');
    ensureEditButton(preview, idx);
  });

  // Events binden (delegiert)
  bindListEvents(list);
}

function bindListEvents(list) {
  list.addEventListener('click', async (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;

    const idxAttr = target.getAttribute('data-idx');
    const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
    if (Number.isNaN(idx) || idx < 0) return;

    // Container-Refs
    const li = target.closest('.expo-akkordeon');
    const preview = li?.querySelector('.expo-preview');
    const generateBtn = li?.querySelector('.btn-generate');
    const regenBtn = li?.querySelector('.btn-regenerate');
    const cancelBtn = li?.querySelector('.btn-cancel');

    // --- Text generieren ---
    if (target.classList.contains('btn-generate') || target.classList.contains('btn-regenerate')) {
      // Doppelklickschutz
      if (window.textJobs[idx]?.running) return;

      // UI: Buttons umschalten
      const oldLabel = generateBtn.textContent;
      generateBtn.disabled = true;
      generateBtn.textContent = target.classList.contains('btn-regenerate')
        ? 'Generiere neu…' : 'Generiere…';
      regenBtn.style.display = 'none';
      cancelBtn.style.display = '';

      // Loader
      const spin = makeSpinner();
      preview?.appendChild(spin);

      setRunning(idx, true);
      setCancel(idx, false);

      // Payload bauen
      const payload = {
        ...state.companyData,
        h1Title: state.titles[idx],
        expoIdx: idx,
      };

      try {
        // 1) Job starten
        const start = await startTextJob({ payload, title: state.titles[idx] });
        let jobId = (start?.jobId || '').toString().replace(/^=+/, '');
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Polling
        let tries = 0;
        const maxTries = 90; // 15 min bei 10s
        while (tries++ <= maxTries) {
          if (window.textJobs[idx]?.cancel) {
            setRunning(idx, false);
            setCancel(idx, false);
            if (spin.parentNode) spin.parentNode.removeChild(spin);
            generateBtn.disabled = false;
            generateBtn.textContent = oldLabel;
            cancelBtn.style.display = 'none';
            // ggf. wieder Neu-Button zeigen, wenn schon Text da war
            if ((state.texts[idx] || '').trim()) regenBtn.style.display = '';
            return;
          }

          const status = await pollTextJob(jobId);
          const st = Array.isArray(status) ? status[0] : status;

          if (st?.status === 'finished') {
            const raw = st?.text || st?.html || '';
            const safeHtml = renderMarkdownToHtml(raw);
            state.texts[idx] = safeHtml;

            if (spin.parentNode) spin.parentNode.removeChild(spin);
            if (preview) {
              preview.innerHTML = safeHtml;
              ensureEditButton(preview, idx);
            }

            // Retry-Fall?
            if (isRetryText(raw)) {
              regenBtn.style.display = '';
            } else {
              hideRegenerate(generateBtn);
            }

            break;
          }

          if (st?.status === 'error') {
            throw new Error(st?.message || 'Fehler bei der Text-Generierung');
          }

          // warten & weiter
          await new Promise((r) => setTimeout(r, 10_000));
        }
      } catch (e) {
        if (spin.parentNode) spin.parentNode.removeChild(spin);
        if (preview) {
          preview.innerHTML = `<div class="error">Fehler: ${e?.message || e}</div>`;
        }
      } finally {
        setRunning(idx, false);
        setCancel(idx, false);
        generateBtn.disabled = false;
        generateBtn.textContent = 'Text generieren';
        cancelBtn.style.display = 'none';
        // Neu generieren zeigen, wenn es schon einen Text gibt
        if ((state.texts[idx] || '').trim()) regenBtn.style.display = '';
      }
    }

    // --- Abbrechen ---
    if (target.classList.contains('btn-cancel')) {
      if (!window.textJobs[idx]?.running) return;
      setCancel(idx, true);
    }
  });
}
