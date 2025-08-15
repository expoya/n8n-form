import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';
import { agentInfo } from '../assets/agentInfo.js';
import { PRESETS } from '../assets/presets.js';
import { primeAudioOnUserGesture, notify } from './ui/notifier.js';

const AUTO_GROW_MAX = {
  regionen: 8,
  zielgruppen: 8,
  produkte: 8,
  attribute: 8,
  zielsetzung: 6,
  keywordliste: 8
};

function sizeTextArea(el) {
  // Max-Zeilen je nach Feldname, Fallback 8
  const name = el.getAttribute('name');
  const maxRows = AUTO_GROW_MAX[name] || 8;

  // erst zurücksetzen, damit scrollHeight korrekt ist
  el.style.height = 'auto';

  const cs = window.getComputedStyle(el);
  const lineHeight = parseFloat(cs.lineHeight) || 20;
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const maxPx = Math.round(lineHeight * maxRows + padding + border);

  // Zielhöhe: Content-Höhe bis zur Obergrenze
  const target = Math.min(el.scrollHeight, maxPx);
  el.style.height = target + 'px';

  // Scrollbar nur zeigen, wenn über Limit
  el.style.overflowY = (el.scrollHeight > maxPx) ? 'auto' : 'hidden';
}

function initAutoGrow(root = document) {
  const areas = root.querySelectorAll('.form-group textarea');
  areas.forEach(el => {
    // initial (auch bei vorbefülltem Inhalt)
    sizeTextArea(el);

    // auf Eingabe reagieren
    el.addEventListener('input', () => sizeTextArea(el));

    // falls Inhalte programmatisch gesetzt werden (Prefill etc.)
    const obs = new MutationObserver(() => sizeTextArea(el));
    obs.observe(el, { characterData: true, childList: true, subtree: true });
  });
}

const tonalities = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];

/* ---------- NEU: Level-Definitionen für Detailgrad & Schreibstil ---------- */
const DETAIL_LEVELS = [
  { value: 1, name: "Einfach",                instruction: "Schreibe kurz und leicht verständlich; vermeide Fachjargon und Details." },
  { value: 2, name: "Eher einfach",           instruction: "Erkläre Grundlagen; nutze wenige, kurz erklärte Fachbegriffe." },
  { value: 3, name: "Neutral",                instruction: "Ausgewogen zwischen Einfachheit und Fachlichkeit; erkläre bei Bedarf." },
  { value: 4, name: "Eher fachlich",          instruction: "Detaillierter mit präziser Terminologie; gib kurze Begründungen." },
  { value: 5, name: "Ausführlich & Fachlich", instruction: "Maximal detailreich und technisch präzise; nutze korrekte Terminologie und Begründungen." }
];

const STYLE_BIAS_LEVELS = [
  { value: 1, name: "Werblich",               instruction: "Emotional, nutzenorientiert, aktive Verben, klare Call-to-Actions." },
  { value: 2, name: "Eher werblich",          instruction: "Benefits priorisieren; sachliche Belege sparsam einstreuen." },
  { value: 3, name: "Neutral",                instruction: "Ausgewogen: Nutzenargumente und Fakten halten sich die Waage." },
  { value: 4, name: "Eher faktenorientiert",  instruction: "Sachlich-präzise; Daten/Belege hervorheben; wenig Werbesprache." },
  { value: 5, name: "Faktenorientiert",       instruction: "Objektiv und nüchtern; evidenzbasiert; keine werblichen Formulierungen." }
];

/* ---------- Helpers: Presets ---------- */
function setSelectValue(selectEl, value) {
  if (!selectEl) return;
  const texts = Array.from(selectEl.options).map(o => o.text);
  if (!texts.includes(value)) return;      // Schutz: Option existiert?
  selectEl.value = value;
  // change-Event feuern, damit State/Listener sauber aktualisieren
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyPreset(name) {
  const conf = PRESETS?.[name];
  if (!conf) return;

  // DOM-IDs der Selects ↔ Keys im State
  const idMap = {
    titleGenerator : 'modelTitleGenerator',
    titleController: 'modelTitleController',
    seoStrategist  : 'modelSeoStrategist',
    microTexter    : 'modelMicroTexter',
    seoVeredler    : 'modelSeoVeredler',
    seoAuditor     : 'modelSeoAuditor'
  };

  // Werte setzen (inkl. Change-Events)
  Object.entries(conf).forEach(([key, val]) => {
    const el = document.getElementById(idMap[key]);
    setSelectValue(el, val);
  });

  // UI/State syncen
  state.selectedPreset = name;
  const presetEl = document.getElementById('modelPreset');
  if (presetEl) presetEl.value = name;
}

function initPresetSelect() {
  const presetEl = document.getElementById('modelPreset');
  if (!presetEl) return;

  // Beim Wechsel Preset anwenden (außer Benutzerdefiniert/leer)
  presetEl.addEventListener('change', () => {
    const val = presetEl.value;
    if (!val || val === 'Benutzerdefiniert') return;
    applyPreset(val);
  });
}

/* ---------- Modal verdrahten ---------- */
export function initAgentModals() {
  const modal     = document.getElementById('infoModal');
  const modalText = document.getElementById('modalText');
  const closeBtn  = modal.querySelector('.close');

  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.agent;
      modalText.innerHTML = agentInfo[key] ?? 'Noch keine Infos hinterlegt.';
      modal.style.display = 'block';
    });
  });

  closeBtn.addEventListener('click', () =>  modal.style.display = 'none');
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
}

/* ---------- Formular-Handling ---------- */
export function initForm() {
  const form = document.getElementById('myForm');
  initAutoGrow(form);

  /* --- Experten-Auswahl initialisieren --- */
  function initExpertSelects() {
    const map = {
      modelTitleGenerator : 'titleGenerator',
      modelTitleController: 'titleController',
      modelSeoStrategist  : 'seoStrategist',
      modelMicroTexter    : 'microTexter',
      modelSeoVeredler    : 'seoVeredler',
      modelSeoAuditor     : 'seoAuditor'
    };

    Object.entries(map).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;

      // Startwert in State spiegeln
      state.agentModels[key] = el.value;

      // Bei manueller Änderung → State updaten & Preset auf "Benutzerdefiniert"
      el.addEventListener('change', () => {
        state.agentModels[key] = el.value;

        const presetEl = document.getElementById('modelPreset');
        // Nur umschalten, wenn zuvor ein Preset aktiv war
        if (presetEl && state.selectedPreset) {
          state.selectedPreset = '';
          presetEl.value = 'Benutzerdefiniert';
        }
      });
    });
  }

  initExpertSelects();   // Dropdowns verdrahten
  initPresetSelect();    // Preset-Dropdown verdrahten
  initAgentModals();     // Info-Buttons & Modal verdrahten

  /* ---------- Slider & Toggle ---------- */
  // Tonalität (mit Initial-Set)
  {
    const tEl  = document.getElementById('tonality');
    const tOut = document.getElementById('tonality-value');
    if (tEl && tOut) {
      const set = v => tOut.textContent = tonalities[(v|0)-1];
      set(parseInt(tEl.value || '3', 10));
      tEl.addEventListener('input', e => set(parseInt(e.target.value || '3', 10)));
    }
  }

 

  // NEU: Detailgrad live anzeigen
  {
    const el  = document.getElementById('detail_level');
    const out = document.getElementById('detail_level-value');
    if (el && out) {
      const set = v => out.textContent = (DETAIL_LEVELS[(v|0)-1]?.name || 'Neutral');
      set(parseInt(el.value || '3', 10));
      el.addEventListener('input', e => set(parseInt(e.target.value || '3', 10)));
    }
  }

  // NEU: Schreibstil live anzeigen
  {
    const el  = document.getElementById('style_bias');
    const out = document.getElementById('style_bias-value');
    if (el && out) {
      const set = v => out.textContent = (STYLE_BIAS_LEVELS[(v|0)-1]?.name || 'Neutral');
      set(parseInt(el.value || '3', 10));
      el.addEventListener('input', e => set(parseInt(e.target.value || '3', 10)));
    }
  }

  /* ---------- Submit ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();

    /* 1) Daten einsammeln */
    const fd = new FormData(form);
    const ortsbezug = (fd.get('ortsbezug') || 'exakt');

// Im State speichern
state.companyData.ortsbezug = ortsbezug;

// Abwärtskompatibel: altes Boolean-Feld weiter befüllen
state.companyData.mitOrtsbezug = (ortsbezug !== 'ohne');

// Ansprache kommt ebenfalls aus dem segmented control (Du | Sie)
state.companyData.ansprache = fd.get('ansprache') || 'Du';
    state.companyData = Object.fromEntries(fd.entries());
    state.companyData.tonality =
      tonalities[parseInt(fd.get('tonality')) - 1];

    // NEU: Detailgrad in Payload (Wert, Label, Instruction)
    {
      const v = parseInt(fd.get('detail_level') || '3', 10);
      const meta = DETAIL_LEVELS[v-1] || DETAIL_LEVELS[2];
      state.companyData.detail_level = v;
      state.companyData.detail_level_label = meta.name;
      state.companyData.detail_level_instruction = meta.instruction; // -> {{detail_level_instruction}}
    }

    // NEU: Schreibstil in Payload (Wert, Label, Instruction)
    {
      const v = parseInt(fd.get('style_bias') || '3', 10);
      const meta = STYLE_BIAS_LEVELS[v-1] || STYLE_BIAS_LEVELS[2];
      state.companyData.style_bias = v;
      state.companyData.style_bias_label = meta.name;
      state.companyData.style_bias_instruction = meta.instruction;   // -> {{style_bias_instruction}}
    }

    /* 2) UI – Loader + Reset */
    showLoader('Titel werden generiert …');
    state.titles = [];
    state.texts  = [];

    /* 3) Job starten */
    let jobId;
    try {
      primeAudioOnUserGesture(); // Aufruf innerhalb echter Button-Geste
      ({ jobId } = await startTitleJob(state.companyData));
      if (!jobId) throw new Error('Keine Job-ID erhalten');
    } catch (err) {
      hideLoader();
      document.getElementById('expoList').innerHTML =
        `<li class="expo-placeholder">Fehler: ${err.message}</li>`;
      return;
    }

    /* 4) Polling */
    state.runningJobId = jobId;
    pollUntilDone(jobId);
  });
} //  ←  HIER wird initForm geschlossen

/* ---------- Poll-Loop ---------- */
async function pollUntilDone(jobId) {
  let tries = 0;
  const maxTries = 90;

  const timer = setInterval(async () => {
    tries++;
    updateLoader(tries);

    let job;
    try {
      job = await pollTitleJob(jobId);
    } catch (err) {
      clearInterval(timer); hideLoader();
      showToast('Polling-Fehler: ' + err.message);
      return;
    }

    if (job.status === 'finished') {
      clearInterval(timer); hideLoader();
      state.titles = JSON.parse(job.result || '[]');
      state.texts  = new Array(state.titles.length).fill('');
      notify('Titel fertig', `${state.titles.length} Expo-Titel wurden generiert.`);
      renderExpoList();
    }
    if (job.status === 'error' || tries > maxTries) {
      clearInterval(timer); hideLoader();
      showToast('Titel-Generierung fehlgeschlagen oder Timeout.');
    }
  }, 10_000);
}
