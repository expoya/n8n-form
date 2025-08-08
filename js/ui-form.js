import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';
import { agentInfo } from '../assets/agentInfo.js';   

const tonalities = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];



/* ---------- Modal verdrahten ---------- */
function initAgentModals(){
  const modal     = document.getElementById('infoModal');
  const modalText = document.getElementById('modalText');
  const closeBtn  = modal.querySelector('.close');

  document.querySelectorAll('.info-btn').forEach(btn=>{
    btn.onclick = () => {
      const key = btn.dataset.agent;
      modalText.innerHTML = agentInfo[key] || 'Noch keine Infos hinterlegt.';
      modal.style.display = 'block';
    };
  });
  closeBtn.onclick = () => modal.style.display = 'none';
  modal.onclick    = e => { if(e.target === modal) modal.style.display = 'none'; };
}

export function initForm(){
  const form = document.getElementById('myForm');

  /* ---------- Experten-Auswahl initialisieren ---------- */
  function initExpertSelects(){
    const map = {
      modelTitleGenerator : 'titleGenerator',
      modelTitleController: 'titleController',
      modelSeoStrategist  : 'seoStrategist',
      modelMicroTexter    : 'microTexter',
      modelSeoVeredler    : 'seoVeredler',
      modelSeoAuditor     : 'seoAuditor'
    };
    Object.entries(map).forEach(([id,key])=>{
      const el = document.getElementById(id);
      if(!el) return;
      state.agentModels[key] = el.value;             // Startwert speichern
      el.onchange = () => state.agentModels[key] = el.value;  // Änderungen nachführen
    });
 

  initExpertSelects();   // Dropdowns verdrahten
  initAgentModals();     // Info-Buttons & Modal verdrahten
 }
  
  /* ---------- Slider & Toggle ---------- */
  document.getElementById('tonality')
          .addEventListener('input',e=>{
              document.getElementById('tonality-value').innerText =
                tonalities[e.target.value-1];
          });
  document.getElementById('ansprache')
          .addEventListener('change',e=>{
              document.getElementById('ansprache-label').innerText =
                e.target.checked ? 'Du' : 'Sie';
          });

  /* ---------- Submit ---------- */
  form.addEventListener('submit', async e=>{
    e.preventDefault();

    /* 1) Daten einsammeln */
    const fd = new FormData(form);
    state.companyData = Object.fromEntries(fd.entries());
    state.companyData.mitOrtsbezug = document.getElementById('mitOrtsbezug').checked;
    state.companyData.ansprache    = document.getElementById('ansprache').checked ? 'Du' : 'Sie';
    state.companyData.tonality     = tonalities[parseInt(fd.get('tonality'))-1];

    /* 2) UI – Loader + Reset */
    showLoader("Titel werden generiert …");
    state.titles = [];
    state.texts  = [];

    /* 3) Job starten – robust mit try/catch */
    let jobId;
    try{
      ({ jobId } = await startTitleJob(state.companyData));
      if(!jobId) throw new Error("Keine Job-ID erhalten");
    }catch(err){
      hideLoader();
      document.getElementById('expoList').innerHTML =
        `<li class="expo-placeholder">Fehler: ${err.message}</li>`;
      return;                        // Abbruch
    }

    /* 4) Polling */
    state.runningJobId = jobId;
    pollUntilDone(jobId);
  });
}

/* ---------- Poll-Loop ---------- */
async function pollUntilDone(jobId){
  let tries = 0;
  const maxTries = 90;

  const timer = setInterval(async ()=>{
    tries++;
    updateLoader(tries);

    let job;
    try{
      job = await pollTitleJob(jobId);
    }catch(err){
      clearInterval(timer); hideLoader();
      showToast("Polling-Fehler: "+err.message);
      return;
    }

    if(job.status === "finished"){
      clearInterval(timer); hideLoader();
      state.titles = JSON.parse(job.result || "[]");
      state.texts  = new Array(state.titles.length).fill("");
      renderExpoList();
    }
    if(job.status === "error" || tries > maxTries){
      clearInterval(timer); hideLoader();
      showToast("Titel-Generierung fehlgeschlagen oder Timeout.");
    }
  }, 10_000);
}
