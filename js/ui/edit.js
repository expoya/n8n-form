// js/ui/edit.js
import { state } from '../state.js';
import { renderMarkdownToHtml } from '../render.js';

export function startEditMode(preview, idx) {
  const currentHtml = state.texts[idx] || preview.innerHTML;

  // HTML -> Markdown (Format beibehalten)
  let markdown = '';
  try {
    markdown = window.turndownService ? window.turndownService.turndown(currentHtml) : currentHtml;
  } catch {
    markdown = currentHtml;
  }

  // existierenden Edit-Button verstecken
  const container = preview.parentNode;
  const existingEditBtn = container.querySelector(`.edit-btn[data-idx="${idx}"]`);
  if (existingEditBtn) existingEditBtn.style.display = 'none';

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.value = markdown;
  textarea.className = 'edit-textarea';

  // Aktionen
  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Speichern';
  saveBtn.className = 'btn btn-primary btn-save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Abbrechen';
  cancelBtn.className = 'btn btn-secondary btn-cancel';

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  // Preview ausblenden & Edit-UI einsetzen
  preview.style.display = 'none';
  container.insertBefore(textarea, preview);
  container.insertBefore(actions, preview);

  // Aktionen binden
  saveBtn.addEventListener('click', () => {
    const newHtml = renderMarkdownToHtml(textarea.value);
    state.texts[idx] = newHtml;
    preview.innerHTML = newHtml;
    cleanupEditMode(preview, textarea, actions, idx);
  });

  cancelBtn.addEventListener('click', () => {
    cleanupEditMode(preview, textarea, actions, idx);
  });
}

export function cleanupEditMode(preview, textarea, actions, idx) {
  textarea.remove();
  actions.remove();
  preview.style.display = '';
  const editBtn = preview.parentNode.querySelector(`.edit-btn[data-idx="${idx}"]`);
  if (editBtn) editBtn.style.display = '';
}

export function ensureEditButton(preview, idx) {
  if (!preview) return;
  const container = preview.parentNode;
  if (container.querySelector(`.edit-btn[data-idx="${idx}"]`)) return;

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.textContent = 'Bearbeiten';
  editBtn.className = 'btn btn-ghost edit-btn';
  editBtn.dataset.idx = idx;

  container.insertBefore(editBtn, preview.nextSibling);
  editBtn.addEventListener('click', () => startEditMode(preview, idx));
}
