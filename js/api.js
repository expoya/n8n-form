const TITLE_START_URL = "https://expoya.app.n8n.cloud/webhook/start-job";
const TITLE_POLL_URL  = "https://expoya.app.n8n.cloud/webhook/get-job?jobId=";
const TEXT_WEBHOOK_URL= "https://expoya.app.n8n.cloud/webhook/bd470388-825f-417b-87c2-67bfee2c119f";

export async function startTitleJob(payload){
  const r = await fetch(TITLE_START_URL,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
  return r.json();           // { jobId }
}

export async function pollTitleJob(jobId){
  const r = await fetch(TITLE_POLL_URL+encodeURIComponent(jobId));
  return r.json();           // { status, result? }
}

export async function generateText(payload){
  const r = await fetch(TEXT_WEBHOOK_URL,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
  return r.json();           // { html }
}
//test
