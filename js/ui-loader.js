let placeholder, spinner;
const floskeln = [
"Die AI-Agents hüpfen im Quadrat, um geile Titel zu basteln…",
        "Die KI brainstormt gerade die wildesten Expo-Ideen.",
        "Gleich kommen die besten Titel aus dem neuronalen Backofen!",
        "Die AI-Agents optimieren noch für Google – bitte einen kurzen Espresso trinken!",
        "Noch ein Moment: Kreativität braucht manchmal eine kurze Denkpause.",
        "Expoya-Titelschmiede läuft auf Hochtouren!",
        "Die Agents würfeln noch ein paar Wörter zusammen…",
        "Die neuronale Kaffeemaschine läuft heiß – Titel kommen sofort!",
        "Bitte kurz chillen – die KI sortiert noch ihre besten Geistesblitze.",
        "Die Synapsen glühen – gleich funkt’s im Titelgenerator.",
        "Noch 3 kreative Purzelbäume, dann sind die Titel da.",
        "Die AI-Agents brainstormen sich gerade selbst in Ekstase.",
        "Noch ein letzter Schwung mit dem Titel-Zauberstab…"
];

/* ...bestehender Code... */
let placeholder, spinner;

export function showLoader(text="🚀 Generierung läuft …"){
  const list=document.getElementById("expoList");

  // Placeholder neu erzeugen
  placeholder=document.createElement("li");
  placeholder.className="expo-placeholder";
  list.innerHTML="";              // alles leeren
  list.appendChild(placeholder);

  // Spinner bauen
  spinner=document.createElement("div");
  spinner.className="loader-spinner";
  const wrap  =document.createElement("div");
  wrap.className="loader-wrap";
  wrap.appendChild(spinner);
  const txt   =document.createElement("span");
  txt.textContent=text;
  wrap.appendChild(txt);
  placeholder.appendChild(wrap);
}

export function updateLoader(sec){
  const frases=[ /* deine Floskeln */ ];
  placeholder.querySelector("span").innerHTML =
    `🚀 Generierung läuft … (${sec}s)<br>`+
    `<span style="font-size:0.9em;color:#98a4c2;">${frases[sec%frases.length]}</span>`;
}

export function hideLoader(){
  if(spinner) spinner.remove();
  placeholder = null;
}

