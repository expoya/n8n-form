import { state } from './state.js';
import { startTitleJob } from './api.js';
import { showLoader, updateLoader, hideLoader } from './ui-loader.js';
import { renderExpoList } from './ui-expos.js';
import { pollTitleJob } from './api.js';


const tonalities = ['Locker','Eher locker','Neutral','Eher formell','Sehr formell'];

export function initForm(){
  const form = document.getElementById('myForm');

  // Tonalität & Ansprache-Slider ------------------------------------------------
  document.getElementById('tonality')
          .addEventListener('input',e=>{
              document.getElementById('tonality-value').innerText = tonalities[e.target.value-1];
          });
  document.getElementById('ansprache')
          .addEventListener('change',e=>{
              document.getElementById('ansprache-label').innerText = e.target.checked ? 'Du' : 'Sie';
          });

  // Submit-Handler ---------------------------------------------------------------
  form.addEventListener('submit', async e=>{
    e.preventDefault();

    // 1) Daten einsammeln
    const fd = new FormData(form);
    state.companyData = Object.fromEntries(fd.entries());
    state.companyData.mitOrtsbezug = document.getElementById('mitOrtsbezug').checked;
    state.companyData.ansprache    = document.getElementById('ansprache').checked ? 'Du' : 'Sie';
    state.companyData.tonality     = tonalities[parseInt(fd.get('tonality'))-1];

    // 2) UI Feedback
    showLoader("Titel werden generiert …");
    state.titles = [];
    state.texts  = [];

    // 3) Start Job
    const { jobId } = await startTitleJob(state.companyData);
    state.runningJobId = jobId;

    // 4) Polling
    pollUntilDone(jobId);
  });
}

/* ---------- internes Polling ----------- */
async function pollUntilDone(jobId){
  let tries=0;
  const maxTries=90;
  const timer=setInterval(async ()=>{
    tries++;
    updateLoader(tries);          // Floskel + Zeit

    const job = await pollTitleJob(jobId);


    // <<< hier eigentlich  const job = await pollTitleJob(jobId);

    if(job.status==="finished"){
      clearInterval(timer); hideLoader();
      state.titles = JSON.parse(job.result||"[]");
      state.texts  = new Array(state.titles.length).fill("");
      renderExpoList();
    }
    if(job.status==="error"||tries>maxTries){
      clearInterval(timer); hideLoader();
      alert("Titel-Generierung fehlgeschlagen oder Timeout.");
    }
  },10000);
}
