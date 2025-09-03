// js/ui-form.js
import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui/renderExpoList.js';
import { agentInfo } from '../assets/agentInfo.js';
import { PRESETS } from '../assets/presets.js';
import { primeAudioOnUserGesture, notify } from './ui/notifier.js';

/* -----------------------------------------
 *  Helpers
 * ----------------------------------------- */
const byId = (id) => document.getElementById(id);

const AUTO_GROW_MAX = {
  regionen: 8,
  zielgruppen: 8,
  produkte: 12,
  keywords: 8
};

function autoGrow(el, maxRows = 6) {
  if (!el) return;
  el.style.height = 'auto';
  const max = (maxRows || 6);
  const scrollH = el.scrollHeight;
  const line = parseInt(getComputedStyle(el).lineHeight || '20', 10);
  const rows = Math.min(max, Math.ceil(scrollH / line));
  el.style.height = `${rows * line + 8}px`;
}

/** kleiner, CSS-freier Klick-Effekt */
function clickFlash(btn) {
  if (!btn) return;
  const prev = btn.style.transform;
  const prevSh = btn.style.boxShadow;
  btn.style.transform = 'scale(0.98)';
  btn.style.boxShadow = '0 0 0 2px rgba(0,0,0,0.08) inset';
  setTimeout(() => {
    btn.style.transform = prev || '';
    btn.style.boxShadow = prevSh || '';
  }, 130);
}

/* -----------------------------------------
 *  Presets + Agent-Info (Info-Modal)
 * ----------------------------------------- */
function fillAgentInfo() {
  const el = byId('agentInfo');
  if (!el) return;
  el.innerHTML = agentInfo;
}

function initPresets() {
  const sel = byId('presetSelect');
  if (!sel || !Array.isArray(PRESETS)) return;
  sel.innerHTML = `<option value="">— Kein Preset —</option>` + PRESETS.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
  sel.addEventListener('change', () => {
    state.selectedPreset = sel.value || '';
    if (sel.value) {
      const p = PRESETS.find(x => x.value === sel.value);
      if (p?.defaults) {
        Object.assign(state.companyData, p.defaults);
        applyFormFromState();
      }
    }
  });
}

/* -----------------------------------------
 *  Form <-> State
 * ----------------------------------------- */
function readFormIntoState() {
  const cd = state.companyData = state.companyData || {};
  cd.firma            = byId('firma')?.value?.trim() || '';
  cd.domain           = byId('domain')?.value?.trim() || '';
  cd.webshop          = byId('webshop')?.value?.trim() || '';
  cd.kurzbeschreibung = byId('kurzbeschreibung')?.value?.trim() || '';

  cd.regionen    = byId('regionen')?.value || '';
  cd.zielgruppen = byId('zielgruppen')?.value || '';
  cd.produkte    = byId('produkte')?.value || '';
  cd.keywords    = byId('keywords')?.value || '';

  const ort = document.querySelector('input[name="ortsbezug"]:checked')?.value || 'ohne';
  cd.ortsbezug = ort;
  cd.mitOrtsbezug = (ort !== 'ohne');

  const ansprache = document.querySelector('input[name="ansprache"]:checked')?.value || 'neutral';
  cd.ansprache = ansprache;
}

function applyFormFromState() {
  const cd = state.companyData || {};
  ['firma','domain','webshop','kurzbeschreibung','regionen','zielgruppen','produkte','keywords']
    .forEach(id => {
      const el = byId(id);
      if (el && cd[id] !== undefined) el.value = cd[id];
    });

  if (cd.ortsbezug) {
    const el = byId(`ort-${cd.ortsbezug}`);
    if (el) el.checked = true;
  }
  if (cd.ansprache) {
    const el = byId(`ansprache-${cd.ansprache}`);
    if (el) el.checked = true;
  }
  ['regionen','zielgruppen','produkte','keywords'].forEach(id => autoGrow(byId(id), AUTO_GROW_MAX[id] || 6));
}

/* -----------------------------------------
 *  Titel-Job starten + stabil pollen
 * ----------------------------------------- */
async function startTitlesFlow(btnRef) {
  readFormIntoState();
  showLoader('Titel werden generiert …');

  // optional: Mini-Klickeffekt auf dem Button
  if (btnRef) clickFlash(btnRef);

  let stopped = false;

  try {
    const payload = { ...state.companyData, agentModels: state.agentModels };
    const startRes = await startTitleJob(payload);
    const jobId = startRes?.jobId || startRes?.id || null;
    if (!jobId) throw new Error('Kein jobId vom Webhook erhalten.');
    state.runningJobId = jobId;

    const startedAt = Date.now();
    const MAX_MS    = 15 * 60 * 1000;
    let delay       = 3000;
    const MAX_DELAY = 15000;

    while (true) {
      if (stopped) break;
      const elapsed = Date.now() - startedAt;
      if (elapsed > MAX_MS) throw new Error('Zeitüberschreitung beim Titel-Polling.');

      updateLoader(`Pollen … (${Math.ceil(elapsed/1000)}s)`);
      const res = await pollTitleJob(jobId);

      const status = (res && (res.status || res[0]?.status)) || 'running';
      const titles = (res && (res.titles || res[0]?.titles)) || [];
      const msg    = (res && (res.message || res[0]?.message)) || '';

      if (status === 'done' || (Array.isArray(titles) && titles.length)) {
        state.titles = Array.from(new Set(titles.map(t => String(t).trim()).filter(Boolean)));
        state.texts  = new Array(state.titles.length).fill('');
        localStorage.setItem('expoya_ce_state_v1', JSON.stringify(state));
        renderExpoList();
        notify('Titel fertig', `Es wurden ${state.titles.length} Titel generiert.`);
        break;
      }

      if (status === 'failed') throw new Error(msg || 'Titel-Job fehlgeschlagen.');

      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(MAX_DELAY, Math.round(delay * 1.5));
    }
  } catch (err) {
    console.error('[Titel-Flow]', err);
    showToast(err?.message || String(err));
  } finally {
    hideLoader();
    state.runningJobId = null;
  }
}

/* -----------------------------------------
 *  Public: Init Agent-Modal + Formular
 * ----------------------------------------- */
export function initAgentModals() {
  fillAgentInfo();
  initPresets();
}

export function initForm() {
  primeAudioOnUserGesture();

  ['regionen','zielgruppen','produkte','keywords'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener('input', () => autoGrow(el, AUTO_GROW_MAX[id] || 6));
    autoGrow(el, AUTO_GROW_MAX[id] || 6);
  });

  const btn = byId('generateTitlesBtn') || byId('generateBtn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      clickFlash(btn);
      startTitlesFlow(btn);
    });
  }

  try {
    const raw = localStorage.getItem('expoya_ce_state_v1');
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        Object.assign(state, saved);
        applyFormFromState();
        if (Array.isArray(state.titles) && state.titles.length) {
          renderExpoList();
        }
      }
    }
  } catch {}
}
