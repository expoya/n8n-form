import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';
import { agentInfo } from '../assets/agentInfo.js';
import { PRESETS } from '../assets/presets.js';
+import { primeAudioOnUserGesture, notify } from './ui/notifier.js';

const tonalities = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];

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
  document.getElementById('tonality')
    .addEventListener('input', e => {
      document.getElementById('tonality-value').innerText =
        tonalities[e.target.value - 1];
    });

  document.getElementById('ansprache')
    .addEventListener('change', e => {
      document.getElementById('ansprache-label').innerText =
        e.target.checked ? 'Du' : 'Sie';
    });

  /* ---------- Submit ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();

    /* 1) Daten einsammeln */
    const fd = new FormData(form);
    state.companyData = Object.fromEntries(fd.entries());
    state.companyData.mitOrtsbezug =
      document.getElementById('mitOrtsbezug').checked;
    state.companyData.ansprache =
      document.getElementById('ansprache').checked ? 'Du' : 'Sie';
    state.companyData.tonality =
      tonalities[parseInt(fd.get('tonality')) - 1];

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
