// js/ui-form.js
import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';
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
  produkte: 8,
  attribute: 8,
  zielsetzung: 6,
  keywordliste: 8
};

function sizeTextArea(el) {
  if (!el) return;
  const name = el.getAttribute('name') || '';
  const maxRows = AUTO_GROW_MAX[name] || 4;

  el.style.height = 'auto';

  const cs = window.getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const maxPx = Math.round(lineHeight * maxRows + padding + border);

  const target = Math.min(el.scrollHeight, maxPx);
  el.style.height = target + 'px';
  el.style.overflowY = (el.scrollHeight > maxPx) ? 'auto' : 'hidden';
}

function initAutoGrow(root = document) {
  const areas = root.querySelectorAll('textarea[name="regionen"], textarea[name="zielgruppen"], textarea[name="produkte"], textarea[name="attribute"], textarea[name="zielsetzung"], textarea[name="keywordliste"]');
  areas.forEach(el => {
    sizeTextArea(el);
    el.addEventListener('input', () => sizeTextArea(el));
    const obs = new MutationObserver(() => sizeTextArea(el));
    obs.observe(el, { characterData: true, childList: true, subtree: true });
  });
}

const TONALITY_LABELS   = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];
const STYLE_LABELS      = ['Werblich','Eher werblich','Neutral','Eher faktenorientiert','Faktenorientiert'];
const DETAIL_LEVELS     = [
  { name: "Einfach",                instruction: "Kurz und leicht verständlich; vermeide Fachjargon und Details." },
  { name: "Eher einfach",           instruction: "Erkläre Grundlagen; nutze wenige, kurz erklärte Fachbegriffe." },
  { name: "Neutral",                instruction: "Ausgewogen zwischen Einfachheit und Fachlichkeit; erkläre bei Bedarf." },
  { name: "Eher fachlich",          instruction: "Detaillierter mit präziser Terminologie; gib kurze Begründungen." },
  { name: "Ausführlich & Fachlich", instruction: "Maximal informativ und technisch präzise; korrekte Terminologie und Begründungen." }
];

function initSlider(id, labelsOrFn) {
  const el  = byId(id);
  const out = byId(`${id}-value`);
  if (!el || !out) return;
  const toLabel = (v) => {
    const n = parseInt(v || '3', 10);
    if (Array.isArray(labelsOrFn)) return labelsOrFn[(n - 1)] || labelsOrFn[2] || 'Neutral';
    if (typeof labelsOrFn === 'function') return labelsOrFn(n);
    return String(n);
  };
  const set = (v) => { out.textContent = toLabel(v); };
  set(el.value);
  el.addEventListener('input', e => set(e.target.value));
}

function readSegmented(form, name, fallback) {
  const val = new FormData(form).get(name);
  return (val == null || val === '') ? fallback : String(val);
}

/* -----------------------------------------
 *  Agent Info Modal
 * ----------------------------------------- */
export function initAgentModals() {
  const modal    = byId('infoModal');
  const modalText= byId('modalText');
  if (!modal || !modalText) return;
  const closeBtn = modal.querySelector('.close');

  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.agent;
      modalText.innerHTML = agentInfo[key] ?? 'Noch keine Infos hinterlegt.';
      modal.style.display = 'block';
    });
  });

  closeBtn && closeBtn.addEventListener('click', () => modal.style.display = 'none');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}

/* -----------------------------------------
 *  Presets & Model-Auswahl
 * ----------------------------------------- */
function applyModelsToSelects(models) {
  const map = {
    titleGenerator: byId('modelTitleGenerator'),
    titleController: byId('modelTitleController'),
    seoStrategist: byId('modelSeoStrategist'),
    microTexter: byId('modelMicroTexter'),
    seoVeredler: byId('modelSeoVeredler'),
    seoAuditor: byId('modelSeoAuditor')
  };
  Object.entries(models || {}).forEach(([k, v]) => {
    const sel = map[k];
    if (sel) {
      // set exact match if exists
      const opt = Array.from(sel.options).find(o => o.value === v || o.textContent === v);
      if (opt) sel.value = opt.value;
      else sel.value = v; // fallback, even wenn Option fehlt
    }
  });
}

function readModelsFromSelects() {
  const val = (id) => byId(id)?.value || '';
  return {
    titleGenerator:  val('modelTitleGenerator'),
    titleController: val('modelTitleController'),
    seoStrategist:   val('modelSeoStrategist'),
    microTexter:     val('modelMicroTexter'),
    seoVeredler:     val('modelSeoVeredler'),
    seoAuditor:      val('modelSeoAuditor')
  };
}

/* -----------------------------------------
 *  Init Form
 * ----------------------------------------- */
export function initForm() {
  const form = byId('myForm');
  if (!form) return;

  // Auto-Grow Textareas & Sliders
  initAutoGrow(form);
  initSlider('tonality',     TONALITY_LABELS);
  initSlider('detail_level', (n) => (DETAIL_LEVELS[(n-1)]?.name || 'Neutral'));
  initSlider('style_bias',   STYLE_LABELS);

  // Preset select
  const presetSel = byId('modelPreset');
  if (presetSel) {
    // init from state.selectedPreset
    if (state.selectedPreset && PRESETS[state.selectedPreset]) {
      presetSel.value = state.selectedPreset;
      applyModelsToSelects(PRESETS[state.selectedPreset]);
    } else {
      applyModelsToSelects(state.agentModels || {});
    }

    presetSel.addEventListener('change', () => {
      const key = presetSel.value || '';
      state.selectedPreset = key;
      const models = PRESETS[key] || {};
      // apply and store
      applyModelsToSelects(models);
      state.agentModels = { ...state.agentModels, ...readModelsFromSelects() };
    });
  } else {
    // kein Preset-Control; trotzdem Selects aus state initialisieren
    applyModelsToSelects(state.agentModels || {});
  }

  // Jede Model-Select-Änderung direkt in den State schreiben
  ['modelTitleGenerator','modelTitleController','modelSeoStrategist','modelMicroTexter','modelSeoVeredler','modelSeoAuditor']
    .forEach(id => {
      const sel = byId(id);
      if (!sel) return;
      sel.addEventListener('change', () => {
        state.agentModels = { ...state.agentModels, ...readModelsFromSelects() };
      });
    });

  // Submit handler: Titel-Job starten
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1) Form → State companyData (Strings)
    const fd = new FormData(form);
    const entries = Object.fromEntries(fd.entries());

    // Mergen, damit abgeleitete Felder nicht überschrieben werden
    state.companyData = { ...(state.companyData || {}), ...entries };

    // Legacy-Feld (Website) sicher entfernen
    delete state.companyData.website;

    // Segmented controls
    const ortsbezug = readSegmented(form, 'ortsbezug', 'exakt');
    const ansprache = readSegmented(form, 'ansprache', 'Du');

    state.companyData.ortsbezug    = ortsbezug;
    state.companyData.mitOrtsbezug = (ortsbezug !== 'ohne');
    state.companyData.ansprache    = ansprache;

    // Klartext-Instruktion fürs Backend
    const ORTSBEZUG_TEXT = {
      ohne:               'Keinen Ortsbezug verwenden',
      exakt:              'Nur exakten Ort verwenden',
      umland:             'Region und Nachbarorte verwenden',
      umland_stadtteile:  'Region, Nachbarorte und Stadtteile verwenden'
    };
    state.companyData.ortsbezug_instruction = ORTSBEZUG_TEXT[ortsbezug] || '';

    // Tonalität
    const ton = parseInt(fd.get('tonality') || '3', 10);
    state.companyData.tonality = TONALITY_LABELS[(ton-1)] || 'Neutral';

    // Detailgrad
    const dl = parseInt(fd.get('detail_level') || '3', 10);
    const dlMeta = DETAIL_LEVELS[(dl-1)] || DETAIL_LEVELS[2];
    state.companyData.detail_level             = dl;
    state.companyData.detail_level_label       = dlMeta.name;
    state.companyData.detail_level_instruction = dlMeta.instruction;

    // Schreibstil
    const sb = parseInt(fd.get('style_bias') || '3', 10);
    const sbMeta = STYLE_LABELS[(sb-1)] || 'Neutral';
    state.companyData.style_bias         = sb;
    state.companyData.style_bias_label   = sbMeta;
    state.companyData.style_bias_instruction =
      (sb === 1) ? "Emotional, nutzenorientiert, aktive Verben, klare Call-to-Actions."
      : (sb === 2) ? "Benefits priorisieren; sachliche Belege sparsam einstreuen."
      : (sb === 4) ? "Sachlich-präzise; Daten/Belege hervorheben; wenig Werbesprache."
      : (sb === 5) ? "Objektiv und nüchtern; evidenzbasiert; keine werblichen Formulierungen."
      : "Ausgewogen: Nutzenargumente und Fakten halten sich die Waage.";

    // Agent-Modelle sicherstellen
    state.agentModels = { ...state.agentModels, ...readModelsFromSelects() };

    /* 2) UI – Loader + Reset */
    showLoader('Titel werden generiert …');
    state.titles = [];
    state.texts  = [];

    /* 3) Job starten */
    let jobId;
    try {
      primeAudioOnUserGesture(); // innerhalb User-Geste
      ({ jobId } = await startTitleJob(state.companyData));
      if (!jobId) throw new Error('Keine Job-ID erhalten');
    } catch (err) {
      hideLoader();
      showToast('Fehler beim Start: ' + (err?.message || err));
      return;
    }

    /* 4) Polling */
    state.runningJobId = jobId;
    pollUntilDone(jobId);
  });
} // end initForm

/* ---------- Poll-Loop ---------- */
async function pollUntilDone(jobId) {
  let tries = 0;
  const maxTries = 90; // 90 * 10s = 15 min

  const timer = setInterval(async () => {
    tries++;
    try { updateLoader(tries); } catch {}

    let job;
    try {
      job = await pollTitleJob(jobId);
    } catch (err) {
      clearInterval(timer); hideLoader();
      showToast('Polling-Fehler: ' + (err?.message || err));
      return;
    }

    if (job?.status === 'finished') {
      clearInterval(timer); hideLoader();
      try {
        state.titles = JSON.parse(job.result || '[]');
      } catch {
        state.titles = Array.isArray(job.result) ? job.result : [];
      }
      state.texts  = new Array(state.titles.length).fill('');
      notify('Titel fertig', `${state.titles.length} Expo-Titel wurden generiert.`);
      renderExpoList();
      return;
    }

    if (job?.status === 'error' || tries > maxTries) {
      clearInterval(timer); hideLoader();
      showToast('Titel-Generierung fehlgeschlagen oder Timeout.');
      return;
    }
    // else: keep polling every 10s
  }, 10_000);
}
