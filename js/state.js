// zentraler, reaktiver Zustand
export const state = {
  companyData   : {},   // Formular-Payload
  titles        : [],   // ["Titel 1", …]
  texts         : [],   // ["<html>", …] 1-zu-1 zu titles.
  runningJobId  : null, // aktuelle Titel-Generierung

  agentModels   : {     //  ← jetzt sauber eingebettet
    seoStrategist : 'Gemini 2.5 Pro',
    microTexter   : 'Gemini 2.5 Flash',
    seoVeredler   : 'ChatGPT 4o',
    seoAuditor    : 'ChatGPT o4 mini'
  }
};                       //  ← hier endet das Gesamt-Objekt :contentReference[oaicite:0]{index=0}
