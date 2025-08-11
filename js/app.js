// js/app.js/
import { initForm, initAgentModals } from './ui-form.js';
import { renderExpoList } from './ui-expos.js';
import { buildXmlFromState, downloadFile } from './export-utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // Seite initialisieren
  initForm();
  initAgentModals();
  renderExpoList();

  // XML-Export (einmalig registrieren)
  document.getElementById("exportXmlBtn")?.addEventListener("click", () => {
    // Optional: Warnung, wenn Texte fehlen
    const total    = window.state?.titles?.length || 0;
    const withText = (window.state?.titles || []).filter((_, i) => (window.state?.texts?.[i] || '').trim() !== '').length;
    const missing  = total - withText;
    if (missing > 0) {
      const ok = confirm(`Achtung: ${missing} von ${total} Einträgen haben noch keinen Text. Trotzdem exportieren?`);
      if (!ok) return;
    }

    const xml = buildXmlFromState(); // oder { onlyWithText: true }
    const ts  = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    downloadFile(`expoya_import_${ts}.xml`, xml);
  });
});
