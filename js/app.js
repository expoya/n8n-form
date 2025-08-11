import { initForm, initAgentModals } from './ui-form.js';
import { renderExpoList} from './ui-expos.js';
import { buildXmlFromState, downloadFile } from './export-utils.js';


  document.addEventListener('DOMContentLoaded', () => {
  initForm();
  initAgentModals();
  renderExpoList();

  // CSV-Export-Listener (falls schon vorhanden) hier ebenfalls
  // ...

  // XML-Export-Listener
  document.getElementById("exportXmlBtn")?.addEventListener("click", () => {
    const xml = buildXmlFromState();
    const ts  = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    downloadFile(`expoya_import_${ts}.xml`, xml);
  });
});




