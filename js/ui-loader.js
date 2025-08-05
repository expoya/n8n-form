let placeholder;
const floskeln = ["AI hüpft …","Synapsen glühen …","Noch 1 Espresso …"];

export function showLoader(msg){
  placeholder = document.querySelector('.expo-placeholder') ||
                document.querySelector('#expoList').firstElementChild;
  placeholder.innerHTML = msg;
}

export function updateLoader(t){
  const sec  = t*10;
  placeholder.innerHTML = `🚀 Generierung läuft … (${sec}s)<br><span style="font-size:0.9em;color:#98a4c2;">${floskeln[t%floskeln.length]}</span>`;
}

export function hideLoader(){
  // nichts – wird von renderExpoList überschrieben
}
