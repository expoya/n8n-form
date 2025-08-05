let placeholder;
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
  // nichts – wird von renderExpoList überschrieben.
}
