import { state } from './state.js';
import { startTitleJob, pollTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader, showToast } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';

const tonalities = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];

export function initForm(){
  const form = document.getElementById('myForm');

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
      alert("Polling-Fehler: "+err.message);
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
      alert("Titel-Generierung fehlgeschlagen oder Timeout.");
    }
  }, 10_000);
}
