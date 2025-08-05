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
        <span class="expo-akk-index">${idx+1}.</span>
        <span class="expo-akk-titel"><span class="expo-titel-text">${titel}</span></span>
        <button class="btn-icon btn-delete" data-idx="${idx}">🗑️</button>
        <button class="btn-expand"         data-idx="${idx}">▼</button>
      </div>
      <div class="expo-akk-body">
        <button class="btn-primary btn-generate" data-idx="${idx}">Text generieren</button>
        <div class="content-preview"></div>
      </div>`;
    list.appendChild(li);
  });

  /* ---------- Text generieren ----------- */
  list.querySelectorAll('.btn-generate').forEach(btn=>btn.onclick=async e=>{
    const idx = btn.dataset.idx;
    btn.disabled=true; btn.textContent="Lädt…";
    const payload={...state.companyData, h1Title:state.titles[idx], expoIdx:idx};
    const {html} = await generateText(payload);
    state.texts[idx]=html;
    btn.style.display="none";
    btn.closest('.expo-akk-body').querySelector('.content-preview').innerHTML = html;
  });

  /* ---------- Weitere Event-Handler (Delete, Edit …) später ergänzen ---------- */
}
