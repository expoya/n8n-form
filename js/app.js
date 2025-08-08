import { initForm }      from './ui-form.js';
import { initForm, initAgentModals } from './ui-form.js';
import { renderExpoList} from './ui-expos.js';

document.addEventListener('DOMContentLoaded', () => {
  initForm();
  initAgentModals();
  renderExpoList();
});
