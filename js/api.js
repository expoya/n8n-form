import { state } from './state.js';

const TITLE_START_URL = "https://expoya.app.n8n.cloud/webhook/start-job";
const TITLE_POLL_URL  = "https://expoya.app.n8n.cloud/webhook/get-job?jobId=";
const TEXT_WEBHOOK_URL= "https://expoya.app.n8n.cloud/webhook/Text-Job-Starter";

/* Hilfsfunktion: liefert JSON oder wirft den Roh-Text */
async function safeJson(res){
  const type = res.headers.get("content-type") || "";
  if(type.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(`Unerwartete API-Antwort (${res.status}): ${text.slice(0,120)}`);
}

export async function startTitleJob(payload){
  const r = await fetch(TITLE_START_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  return safeJson(r);          // { jobId }
}

export async function pollTitleJob(jobId){
  const r = await fetch(TITLE_POLL_URL + encodeURIComponent(jobId));
  return safeJson(r);          // { status, result? }
}

export async function generateText(payload){
 const r = await fetch(TEXT_WEBHOOK_URL, {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify(payload,
     agentModels: state.agentModels,titleModel : state.agentModels.titleGenerator) //  ← jetzt korrekt IN der Payload    })
 });
  return safeJson(r);          // { html }
}
