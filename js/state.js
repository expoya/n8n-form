// zentraler, reaktiver Zustand
export const state = {
  companyData   : {},   // Formular-Payload
  titles        : [],   // ["Titel 1", …]
  texts         : [],   // ["<html>", …] 1-zu-1 zu titles.
  runningJobId  : null, // aktuelle Titel-Generierung
};
