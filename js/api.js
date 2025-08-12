// js/api.js
import { state } from "./state.js";

/**
 * Hilfsfunktion: Antwort sicher als JSON lesen.
 * Auch robust bei leerem Body oder falschem Content-Type.
 */
async function safeJson(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const bodyText = await res.text(); // Body nur einmal lesen

  // Optionales Debugging:
  console.debug("[safeJson]", res.status, ct, bodyText?.slice(0, 200));

  if (ct.includes("application/json")) {
    if (!bodyText || bodyText.trim() === "") return {};
    try {
      return JSON.parse(bodyText);
    } catch (e) {
      throw new Error(
        `Ungültiges JSON (${res.status}): ${bodyText.slice(0, 200)}`
      );
    }
  }
  // Kein JSON – Klartext-Fehler mit Body-Auszug
  throw new Error(
    `Unerwartete API-Antwort (${res.status} ${res.statusText}): ${bodyText.slice(0, 200)}`
  );
}

/* -----------------------------
 * Endpoints
 * --------------------------- */
const TITLE_START_URL  = "https://expoya.app.n8n.cloud/webhook/start-job";
const TITLE_POLL_URL   = "https://expoya.app.n8n.cloud/webhook/get-job?jobId=";
const TEXT_WEBHOOK_URL = "https://expoya.app.n8n.cloud/webhook/Text-Job-Starter";
const TEXT_POLL_URL    = "https://expoya.app.n8n.cloud/webhook/text-get-job?jobId=";

/* -------------------------------------------------
 * 1) Titel-Job anstoßen
 * Erwartet: die Unternehmens-/Formulardaten.
 * Modelle hängen wir zentral aus dem State an.
 * ------------------------------------------------- */
export async function startTitleJob(companyData = {}) {
  const finalPayload = {
    ...companyData,
    agentModels: state.agentModels || {},
    titleModel : state?.agentModels?.titleGenerator, // optional
  };

  const res = await fetch(TITLE_START_URL, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(finalPayload),
  });

  // Erwartet z. B.: { jobId: "abc-123" }
  return safeJson(res);
}

/* -------------------------------------------------
 * 2) Titel-Job: Polling
 * Gibt { status: "running" | "finished" | "error", result? } zurück.
 * ------------------------------------------------- */
export async function pollTitleJob(jobId) {
  const res = await fetch(`${TITLE_POLL_URL}${encodeURIComponent(jobId)}`, {
    cache  : "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  return safeJson(res);
}

/* -------------------------------------------------
 * 3) Text-Job starten (für die Einzel-Texte je Titel)
 * ------------------------------------------------- */
export async function startTextJob(payload = {}) {
  const completePayload = {
    ...payload,
    agentModels: state.agentModels || {},
    textModel  : state?.agentModels?.seoVeredler, // falls vorhanden
  };

  const res = await fetch(TEXT_WEBHOOK_URL, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(completePayload),
  });

  // Erwartet: { jobId: "…" }
  return safeJson(res);
}

/* -------------------------------------------------
 * 4) Text-Job: Polling
 * ------------------------------------------------- */
export async function pollTextJob(jobId) {
  // Cache-Buster gegen Browser/CDN Caching
  const url = `${TEXT_POLL_URL}${encodeURIComponent(jobId)}&_=${Date.now()}`;
  const res = await fetch(url, {
    cache  : "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  return safeJson(res); // dein Flow liefert üblicherweise Array[0] mit Status/Text
}
