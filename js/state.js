// zentraler, reaktiver Zustand
export const state = {
  companyData   : {},   // Formular-Payload
  titles        : [],   // ["Titel 1", …]
  texts         : [],   // ["<html>", …] 1-zu-1 zu titles.
  runningJobId  : null, // aktuelle Titel-Generierung
  selectedPreset: '',   // aktuelles Preset
  gen: {}  // z.B. state.gen[3] = { active, cancelled, timer, abortCtrl }

  agentModels   : {     //  ← jetzt sauber eingebettet
    titleGenerator: 'ChatGPT 5 mini',
    titleController: 'ChatGPT 4.1 mini',
    seoStrategist : 'ChatGPT o4 mini',
    microTexter   : 'Gemini 2.5 Flash',
    seoVeredler   : 'Claude Sonnet 4',
    seoAuditor    : 'ChatGPT o4 mini'
  }
};                       //  ← hier endet das Gesamt-Objekt :contentReference[oaicite:0]{index=0}
