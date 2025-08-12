// js/ui-expos.js
import { state } from './state.js';
import { startTextJob, pollTextJob } from './api.js';
import { renderMarkdownToHtml } from './render.js';
import { startLoading, stopLoading } from './ui/loading.js';
import { ladeFloskelnTexte } from './ui/constants.js';

// Runtime Job-Status
if (!window.textJobs) window.textJobs = {}; // { [idx]: { running: bool, cancel: bool } }

// Utils
const q  = (sel, root=document) => root.querySelector(sel);
const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const POLL_DELAY = 10_000; // 10s
const MAX_TRIES  = 90;     // 15 Min

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
  if (container.querySelector('.edit-btn')) return;

  const b = document.createElement('button');
  b.className = 'btn btn-secondary edit-btn';
  b.textContent = 'Bearbeiten';
  b.addEventListener('click', () => enterEditMode(container, idx));
  container.appendChild(b);
}

function enterEditMode(container, idx) {
  const html = state.texts?.[idx] || '';
  const md = window.turndownService ? window.turndownService.turndown(html) : html;

  container.innerHTML = `
    <textarea class="text-editarea" rows="10">${md}</textarea>
    <div class="edit-actions">
      <button class="btn btn-primary btn-save">Speichern</button>
      <button class="btn btn-secondary btn-cancel-edit">Abbrechen</button>
    </div>
  `;

  const ta = container.querySelector('.text-editarea');
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
  const hasText    = (state.texts?.[idx] || '').trim() !== '';
  const running    = !!window.textJobs[idx]?.running;
  const generate   = li.querySelector('.btn-generate-text');
  const regenerate = li.querySelector('.btn-regenerate-text');
  const cancelBtn  = li.querySelector('.btn-cancel-text');

  if (!generate || !regenerate || !cancelBtn) return;

  generate.disabled        = running;
  cancelBtn.style.display  = running ? '' : 'none';
  regenerate.style.display = hasText && !running ? '' : 'none';
}

function toggleAccordion(li, open, listRoot) {
  if (open) {
    qa('.expo-akkordeon.open', listRoot).forEach(other => {
      if (other !== li) other.classList.remove('open');
    });
    li.classList.add('open');
  } else {
    li.classList.remove('open');
  }
}

// ---- Titel bearbeiten / löschen ----
function startTitleEdit(header, idx) {
  const titleSpan   = header.querySelector('.expo-titel-text');
  const oldTitle    = titleSpan?.textContent || '';
  const controlsOld = header.querySelector('.header-controls');
  if (!titleSpan) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldTitle;
  input.className = 'title-input';
  input.style.minWidth = '40%';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-save-title';
  saveBtn.textContent = 'Speichern';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary btn-cancel-title';
  cancelBtn.textContent = 'Abbrechen';

  titleSpan.replaceWith(input);

  const ctrl = document.createElement('span');
  ctrl.className = 'header-controls';
  ctrl.style.display = 'inline-flex';
  ctrl.style.gap = '6px';
  ctrl.append(saveBtn, cancelBtn);

  if (controlsOld) controlsOld.replaceWith(ctrl);
  else header.appendChild(ctrl);

  const finish = () => {
    const span = document.createElement('span');
    span.className = 'expo-titel-text';
    span.textContent = state.titles[idx] || oldTitle;
    input.replaceWith(span);
    ctrl.replaceWith(buildHeaderControls(idx));
  };

  saveBtn.onclick = () => {
    const v = (input.value || '').trim();
    if (!v) { input.focus(); return; }
    state.titles[idx] = v;
    finish();
  };
  cancelBtn.onclick = () => finish();

  input.focus();
  input.select();
}

function buildHeaderControls(idx) {
  const wrap = document.createElement('span');
  wrap.className = 'header-controls';
  wrap.style.display = 'inline-flex';
  wrap.style.gap = '4px';

  const btnEdit = document.createElement('button');
  btnEdit.className = 'btn-icon btn-edit-title';
  btnEdit.title = 'Bearbeiten';
  btnEdit.textContent = '✏️';
  btnEdit.dataset.idx = String(idx);

  const btnDelete = document.createElement('button');
  btnDelete.className = 'btn-icon btn-delete';
  btnDelete.title = 'Entfernen';
  btnDelete.textContent = '🗑️';
  btnDelete.dataset.idx = String(idx);

  const btnExpand = document.createElement('button');
  btnExpand.className = 'btn-expand';
  btnExpand.title = 'Details';
  btnExpand.textContent = '▼';
  btnExpand.dataset.idx = String(idx);

  wrap.append(btnEdit, btnDelete, btnExpand);
  return wrap;
}

function deleteTitle(idx) {
  if (window.textJobs[idx]?.running) {
    alert('Bitte zuerst den laufenden Job abbrechen.');
    return false;
  }
  state.titles.splice(idx, 1);
  if (Array.isArray(state.texts)) state.texts.splice(idx, 1);

  // Reindex textJobs
  const oldJobs = window.textJobs || {};
  const newJobs = {};
  Object.keys(oldJobs).forEach(k => {
    const i = Number(k);
    if (!Number.isInteger(i)) return;
    if (i < idx) newJobs[i]   = oldJobs[i];
    if (i > idx) newJobs[i-1] = oldJobs[i];
  });
  window.textJobs = newJobs;

  return true;
}

// --- Robustes Extrahieren des generierten Texts ---
function pickTextFromStatus(st) {
  // n8n-Varianten robust abdecken
  return (
    st?.html ??
    st?.text ??
    st?.result ??
    st?.content ??
    st?.payload ??
    ''
  );
}

// PUBLIC
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
        <span class="header-controls">
          <button class="btn-icon btn-edit-title" data-idx="${idx}" title="Bearbeiten">✏️</button>
          <button class="btn-icon btn-delete"      data-idx="${idx}" title="Entfernen">🗑️</button>
          <button class="btn-expand"               data-idx="${idx}" title="Details">▼</button>
        </span>
      </div>

      <div class="expo-akk-body" data-idx="${idx}">
        <div class="text-preview" data-idx="${idx}">
          ${(state.texts[idx] || '').trim() || '<em>Noch kein Text generiert.</em>'}
        </div>

        <div class="text-actions" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
          <button class="btn btn-primary btn-generate-text"    data-idx="${idx}">Text generieren</button>
          <button class="btn btn-secondary btn-regenerate-text" data-idx="${idx}" style="display:none;">Neu generieren</button>
          <button class="btn btn-secondary btn-cancel-text"     data-idx="${idx}" style="display:none;">Abbrechen</button>
        </div>
      </div>
    `;
    list.appendChild(li);

    ensureEditButton(li.querySelector('.text-preview'), idx);
    updateActionButtons(li, idx);
  });

  bindAccordionAndActions(list);
  const first = list.querySelector('.expo-akkordeon');
  if (first) toggleAccordion(first, true, list);
}

// Single binding + Handler
function bindAccordionAndActions(list) {
  if (list.dataset.bound === '1') return;
  list.dataset.bound = '1';
  list.addEventListener('click', onListClick);
}

async function onListClick(ev) {
  const el = ev.target;
  if (!(el instanceof HTMLElement)) return;

  // Expand-Button: nur toggeln
  const expandBtn = el.closest('.btn-expand');
  if (expandBtn) {
    const li = expandBtn.closest('.expo-akkordeon');
    const list = li?.parentElement;
    const isOpen = li.classList.contains('open');
    toggleAccordion(li, !isOpen, list);
    return;
  }

  // Header-Klick toggelt nur, wenn NICHT auf Controls/Input geklickt
  const header = el.closest('.expo-akk-header');
  if (header && !el.closest('.header-controls') && !el.closest('.title-input')) {
    const li = header.closest('.expo-akkordeon');
    const list = li?.parentElement;
    const isOpen = li.classList.contains('open');
    toggleAccordion(li, !isOpen, list);
    header.setAttribute('aria-expanded', String(!isOpen));
    return;
  }

  // Titel bearbeiten
  const btnEditTitle = el.closest('.btn-edit-title');
  if (btnEditTitle) {
    const idx = parseInt(btnEditTitle.dataset.idx, 10);
    const head = btnEditTitle.closest('.expo-akk-header');
    startTitleEdit(head, idx);
    return;
  }

  // Titel löschen
  const btnDeleteTitle = el.closest('.btn-delete');
  if (btnDeleteTitle) {
    const idx = parseInt(btnDeleteTitle.dataset.idx, 10);
    const ok = confirm('Diesen Titel wirklich löschen?');
    if (!ok) return;
    if (deleteTitle(idx)) renderExpoList();
    return;
  }

  // --- Text-Buttons im Body ---
  const btn = el.closest('button');
  if (!btn) return;

  const idxAttr = btn.getAttribute('data-idx');
  const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
  if (Number.isNaN(idx) || idx < 0) return;

  const li         = btn.closest('.expo-akkordeon');
  const preview    = li?.querySelector('.text-preview');
  const generate   = li?.querySelector('.btn-generate-text');
  const regenerate = li?.querySelector('.btn-regenerate-text');
  const cancelBtn  = li?.querySelector('.btn-cancel-text');

  // Abbrechen
  if (btn.classList.contains('btn-cancel-text')) {
    if (!window.textJobs[idx]?.running) return;
    window.textJobs[idx] = { running: false, cancel: true };
    return;
  }

  // Generieren / Neu generieren
  if (btn.classList.contains('btn-generate-text') || btn.classList.contains('btn-regenerate-text')) {
    if (window.textJobs[idx]?.running) return;

    // Loader mit Floskeln starten
    startLoading(preview, ladeFloskelnTexte);

    const oldLabel = generate.textContent;
    generate.disabled = true;
    generate.textContent = btn.classList.contains('btn-regenerate-text') ? 'Generiere neu…' : 'Generiere…';
    regenerate.style.display = 'none';
    cancelBtn.style.display  = '';

    window.textJobs[idx] = { running: true, cancel: false };

    const payload = { ...state.companyData, h1Title: state.titles[idx], expoIdx: idx };

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
          stopLoading(preview);
          preview.innerHTML = (state.texts[idx] || '').trim() || '<em>Abgebrochen.</em>';
          generate.disabled = false;
          generate.textContent = oldLabel;
          cancelBtn.style.display = 'none';
          if ((state.texts[idx] || '').trim()) regenerate.style.display = '';
          return;
        }

        const status = await pollTextJob(jobId);
        const st = Array.isArray(status) ? status[0] : status;

        if (st?.status === 'finished') {
          const raw = pickTextFromStatus(st);
          const safeHtml = renderMarkdownToHtml(raw);
          state.texts[idx] = safeHtml;

          stopLoading(preview);
          preview.innerHTML = safeHtml;
          ensureEditButton(preview, idx);

          regenerate.style.display = (isRetryText(raw) || (state.texts[idx] || '').trim()) ? '' : 'none';
          break;
        }

        if (st?.status === 'error') {
          throw new Error(st?.message || 'Fehler bei der Text-Generierung');
        }

        await sleep(POLL_DELAY);
      }
    } catch (e) {
      stopLoading(preview);
      preview.innerHTML = `<div class="error">Fehler: ${e?.message || e}</div>`;
    } finally {
      window.textJobs[idx] = { running: false, cancel: false };
      generate.disabled = false;
      generate.textContent = 'Text generieren';
      cancelBtn.style.display = 'none';
      if ((state.texts[idx] || '').trim()) regenerate.style.display = '';
    }
  }
}
