// js/ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';
import { renderMarkdownToHtml } from './render.js';

// --- Runtime Job-Status ---
if (!window.textJobs) window.textJobs = {}; // { [idx]: { running: bool, cancel: bool } }

// --- kleine Utils ---
const q  = (sel, root=document) => root.querySelector(sel);
const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const POLL_DELAY = 10_000; // 10s
const MAX_TRIES  = 90;     // 15 Min

function spinner() {
  const s = document.createElement('span');
  s.className = 'mini-spinner';
  s.textContent = '…';
  s.setAttribute('aria-busy', 'true');
  return s;
}

function isRetryText(s) {
  const t = (s || '').toLowerCase();
  return (
    t.includes('ich konnte keinen text generieren') ||
    t.includes('kein text zurückgegeben') ||
    t.includes('nochmal versuchen') ||
    t.trim() === ''
  );
}

function ensureEditButton(container, idx) {
  if (!container) return;
  const hasText = (state.texts?.[idx] || '').trim() !== '';
  if (!hasText) return;
  if (container.querySelector('.btn-edit')) return;

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
    : html;

  container.innerHTML = `
    <textarea class="expo-edit" rows="10">${md}</textarea>
    <div class="edit-actions" style="margin-top:8px; display:flex; gap:8px;">
      <button class="btn btn-primary btn-save">Speichern</button>
      <button class="btn btn-secondary btn-cancel-edit">Abbrechen</button>
    </div>
  `;

  const ta = container.querySelector('.expo-edit');
  container.querySelector('.btn-save').onclick = () => {
    const newMd = ta.value || '';
    const safeHtml = renderMarkdownToHtml(newMd);
    state.texts[idx] = safeHtml;
    container.innerHTML = safeHtml;
    ensureEditButton(container, idx);
  };
  container.querySelector('.btn-cancel-edit').onclick = () => {
    container.innerHTML = html;
    ensureEditButton(container, idx);
  };
}

function updateActionButtons(li, idx) {
  const hasText   = (state.texts?.[idx] || '').trim() !== '';
  const running   = !!window.textJobs[idx]?.running;
  const generate  = li.querySelector('.btn-generate');
  const regenerate= li.querySelector('.btn-regenerate');
  const cancelBtn = li.querySelector('.btn-cancel');

  if (!generate || !regenerate || !cancelBtn) return;

  generate.disabled = running;
  cancelBtn.style.display = running ? '' : 'none';
  regenerate.style.display = hasText && !running ? '' : 'none';
}

function toggleAccordion(li, open, listRoot) {
  const body   = li.querySelector('.expo-akk-body');
  const header = li.querySelector('.expo-akk-header');
  if (!body || !header) return;

  if (open) {
    // andere schließen
    qa('.expo-akkordeon.open', listRoot).forEach(other => {
      if (other !== li) {
        other.classList.remove('open');
        const obody = other.querySelector('.expo-akk-body');
        const ohead = other.querySelector('.expo-akk-header');
        if (obody) obody.hidden = true;
        if (ohead) ohead.setAttribute('aria-expanded', 'false');
      }
    });
    li.classList.add('open');
    body.hidden = false;
    header.setAttribute('aria-expanded', 'true');
  } else {
    li.classList.remove('open');
    body.hidden = true;
    header.setAttribute('aria-expanded', 'false');
  }
}

// --- PUBLIC: Liste rendern ---
export function renderExpoList() {
  const list = q('#expoList');
  if (!list) return;

  const titles = state.titles || [];
  if (!state.texts || state.texts.length !== titles.length) {
    state.texts = new Array(titles.length).fill('');
  }

  list.innerHTML = '';

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
      <div class="expo-akk-header" data-idx="${idx}" role="button" aria-expanded="false">
        <span class="expo-akk-index">${idx + 1}.</span>
        <span class="expo-akk-titel"><span class="expo-titel-text">${title}</span></span>
        <span class="chevron" aria-hidden="true"></span>
      </div>

      <div class="expo-akk-body" data-idx="${idx}" hidden>
        <div class="expo-preview" data-idx="${idx}">
          ${(state.texts[idx] || '').trim() || '<em>Noch kein Text generiert.</em>'}
        </div>

        <div class="expo-actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-generate"  data-idx="${idx}">Text generieren</button>
          <button class="btn btn-secondary btn-regenerate" data-idx="${idx}" style="display:none;">Neu generieren</button>
          <button class="btn btn-secondary btn-cancel"    data-idx="${idx}" style="display:none;">Abbrechen</button>
        </div>
      </div>
    `;
    list.appendChild(li);

    // Edit-Button nur, wenn Text existiert
    const preview = li.querySelector('.expo-preview');
    ensureEditButton(preview, idx);

    // Buttons initial passend setzen
    updateActionButtons(li, idx);
  });

  bindAccordionAndActions(list);

  // Optional: Erstes Element geöffnet anzeigen
  const first = list.querySelector('.expo-akkordeon');
  if (first) toggleAccordion(first, true, list);
}

// --- Events (Akkordeon + Buttons) ---
function bindAccordionAndActions(list) {
  list.addEventListener('click', async (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLElement)) return;

    // Akkordeon-Header
    if (el.closest('.expo-akk-header')) {
      const header = el.closest('.expo-akk-header');
      const li = header.closest('.expo-akkordeon');
      const isOpen = li.classList.contains('open');
      toggleAccordion(li, !isOpen, list);
      return;
    }

    // Buttons
    const btn = el.closest('button');
    if (!btn) return;
    const idxAttr = btn.getAttribute('data-idx');
    const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
    if (Number.isNaN(idx) || idx < 0) return;

    const li = btn.closest('.expo-akkordeon');
    const preview = li?.querySelector('.expo-preview');
    const generateBtn = li?.querySelector('.btn-generate');
    const regenBtn = li?.querySelector('.btn-regenerate');
    const cancelBtn = li?.querySelector('.btn-cancel');

    // Abbrechen
    if (btn.classList.contains('btn-cancel')) {
      if (!window.textJobs[idx]?.running) return;
      window.textJobs[idx] = { running: false, cancel: true };
      return;
    }

    // Generieren / Neu generieren
    if (btn.classList.contains('btn-generate') || btn.classList.contains('btn-regenerate')) {
      if (window.textJobs[idx]?.running) return;

      const spin = spinner();
      preview?.appendChild(spin);

      const oldLabel = generateBtn.textContent;
      generateBtn.disabled = true;
      generateBtn.textContent = btn.classList.contains('btn-regenerate') ? 'Generiere neu…' : 'Generiere…';
      regenBtn.style.display = 'none';
      cancelBtn.style.display = '';

      window.textJobs[idx] = { running: true, cancel: false };

      const payload = {
        ...state.companyData,
        h1Title: state.titles[idx],
        expoIdx: idx,
      };

      try {
        // 1) Start
        const start = await startTextJob({ payload, title: state.titles[idx] });
        let jobId = (start?.jobId || '').toString().replace(/^=+/, '');
        if (!jobId) throw new Error('Keine Text-Job-ID erhalten');

        // 2) Poll
        let tries = 0;
        while (tries++ <= MAX_TRIES) {
          if (window.textJobs[idx]?.cancel) {
            window.textJobs[idx] = { running: false, cancel: false };
            if (spin.parentNode) spin.parentNode.removeChild(spin);
            generateBtn.disabled = false;
            generateBtn.textContent = oldLabel;
            cancelBtn.style.display = 'none';
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
            preview.innerHTML = safeHtml;
            ensureEditButton(preview, idx);

            if (isRetryText(raw)) {
              regenBtn.style.display = '';
            } else {
              regenBtn.style.display = (state.texts[idx] || '').trim() ? '' : 'none';
            }
            break;
          }

          if (st?.status === 'error') {
            throw new Error(st?.message || 'Fehler bei der Text-Generierung');
          }

          await sleep(POLL_DELAY);
        }
      } catch (e) {
        if (spin.parentNode) spin.parentNode.removeChild(spin);
        preview.innerHTML = `<div class="error">Fehler: ${e?.message || e}</div>`;
      } finally {
        window.textJobs[idx] = { running: false, cancel: false };
        generateBtn.disabled = false;
        generateBtn.textContent = 'Text generieren';
        cancelBtn.style.display = 'none';
        if ((state.texts[idx] || '').trim()) regenBtn.style.display = '';
      }
    }
  });
}
