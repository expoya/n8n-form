import { state } from './state.js';
import { generateText } from './api.js';

export function renderExpoList(){
  const list=document.getElementById('expoList');
  list.innerHTML="";
  state.titles.forEach((titel,idx)=>{
    const li=document.createElement('li');
    li.className="expo-akkordeon";
    li.innerHTML=`
     
  <div class="expo-akk-header" data-idx="${idx}">
    <span class="expo-akk-index">${idx + 1}.</span>
    <span class="expo-akk-titel"><span class="expo-titel-text">${titel}</span></span>
    <button class="btn-icon btn-edit-title" data-idx="${idx}" title="Bearbeiten">✏️</button>
    <button class="btn-icon btn-delete"      data-idx="${idx}" title="Entfernen">🗑️</button>
    <button class="btn-expand"               data-idx="${idx}" title="Details">▼</button>
  </div>

  <div class="expo-akk-body">
    <button class="btn-primary btn-generate-text" data-idx="${idx}">Text generieren</button>
    <div class="text-preview"></div>
  </div>
`;

    list.appendChild(li);
  });

  /* ---------- Akkordeon öffnen / schließen ---------- */
list.querySelectorAll('.btn-expand').forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    const acc = btn.closest('.expo-akkordeon');
    acc.classList.toggle('open');
    btn.textContent = acc.classList.contains('open') ? '▲' : '▼';
  };
});
  /* ---------- Text generieren im Akkordeon ---------- */
list.querySelectorAll('.btn-generate-text').forEach(btn=>{
  btn.onclick = async e => {
    e.stopPropagation();
    const idx = btn.dataset.idx;
    btn.disabled = true; btn.textContent = '⏳ …';
    const payload = { ...state.companyData, h1Title: state.titles[idx], expoIdx: idx };
    const { html } = await generateText(payload);
    state.texts[idx] = html;
    btn.remove();                                           // Button ausblenden
    btn.closest('.expo-akk-body').querySelector('.text-preview').innerHTML = html;
  };
});

/* ---------- show/hide Body beim Akkordeon-Toggle ---------- */
list.querySelectorAll('.expo-akkordeon').forEach(acc => {
  acc.addEventListener('click', e => {
    if (e.target.closest('.expo-akk-header')) {
      const body = acc.querySelector('.text-section');
      if (acc.classList.contains('open')) body.style.display = 'block';
      else body.style.display = 'none';
    }
  });
});

/* ---------- Titel bearbeiten ---------- */
list.querySelectorAll('.btn-edit-title').forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    const idx   = btn.dataset.idx;
    const acc   = btn.closest('.expo-akkordeon');
    const span  = acc.querySelector('.expo-titel-text');
    const input = document.createElement('input');
    input.value = span.textContent;
    input.className = 'edit-inline';
    span.replaceWith(input);
    input.focus();

    input.onblur = () => {
      const val = input.value.trim();
      if (val) {
        state.titles[idx] = val;
        input.replaceWith(span);
        span.textContent = val;
      } else {
        input.replaceWith(span);
      }
    };
  };
});

/* ---------- Weitere Event-Handler (Delete, Edit …) später ergänzen ---------- */
}
