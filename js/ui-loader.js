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

export function showLoader(text = "🚀 Läuft …") {
  const list = document.getElementById("expoList");

  // Placeholder neu anlegen oder wiederverwenden
  if (!placeholder) {
    placeholder = document.createElement("li");
    placeholder.className = "expo-placeholder";
    list.innerHTML = "";              // sicher leeren
    list.appendChild(placeholder);
  }
  placeholder.innerHTML = text;
}

export function updateLoader(tick) {
  const sec = tick * 10;
  const fl = floskeln[tick % floskeln.length];
  if (placeholder) {
    placeholder.innerHTML =
      `🚀 Generierung läuft … (${sec}s)<br>` +
      `<span style="font-size:0.9em;color:#98a4c2;">${fl}</span>`;
  }
}

export function hideLoader() {
  // Placeholder wird von renderExpoList ersetzt – einfach zurücksetzen
  placeholder = null;
}
