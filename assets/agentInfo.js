/* ---------- Agent-Erklärungen ---------- */
export const agentInfo = {
  titleGenerator: `Erstellt eine Liste potenzieller Expo-Titel basierend auf deinen Eingaben.
Verfügbare Modelle:\n• Gemini 2.5 Pro\n• Claude Sonnet 4\n• ChatGPT 4.1\n• ChatGPT o4 mini`,

  titleController: `Prüft generierte Titel auf Länge, Click-Through-Rate und Keyword-Abdeckung …`,


  seoStrategist  : /* html */ `
    <p>
      Der <b>SEO-Stratege</b> ist der „Architekt” deines Textes. Er erstellt
      basierend auf deinem Briefing eine hoch­intelligente und kreative
      Gliederung, die als Bauplan für alle weiteren Schritte dient.
    </p>

    <h4>Modelle zur Auswahl:</h4>

    <details>
      <summary><b>Gemini 2.5 Pro</b></summary>
      <table class="model-table">
        <tr><td class="category">Kreativität & Stil:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Logik & Reasoning:</td><td>★★★★★</td></tr>
        <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Geschwindigkeit:</td><td>★★★☆☆</td></tr>
        <tr><td class="category">Kosten-Effizienz:</td><td>★★☆☆☆</td></tr>
      </table>
    </details>

    <details>
      <summary><b>Claude 3.5 Sonnet</b></summary>
      <table class="model-table">
        <tr><td class="category">Kreativität & Stil:</td><td>★★★★★</td></tr>
        <tr><td class="category">Logik & Reasoning:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Geschwindigkeit:</td><td>★★★☆☆</td></tr>
        <tr><td class="category">Kosten-Effizienz:</td><td>★★★☆☆</td></tr>
      </table>
    </details>

    <details>
      <summary><b>ChatGPT 4.1 (Turbo)</b></summary>
      <table class="model-table">
        <tr><td class="category">Kreativität & Stil:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Logik & Reasoning:</td><td>★★★★★</td></tr>
        <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★★</td></tr>
        <tr><td class="category">Geschwindigkeit:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Kosten-Effizienz:</td><td>★★★☆☆</td></tr>
      </table>
    </details>

    <details>
      <summary><b>ChatGPT 4o-mini</b></summary>
      <table class="model-table">
        <tr><td class="category">Kreativität & Stil:</td><td>★★★☆☆</td></tr>
        <tr><td class="category">Logik & Reasoning:</td><td>★★★☆☆</td></tr>
        <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
        <tr><td class="category">Geschwindigkeit:</td><td>★★★★★</td></tr>
        <tr><td class="category">Kosten-Effizienz:</td><td>★★★★★</td></tr>
      </table>
    </details>
  `,

  microTexter : `
  <p>
        Der <b>Mikro-Texter</b> ist der fleißige "Bauarbeiter". Er setzt in einer Schleife die einzelnen Gliederungspunkte des Strategen diszipliniert in ansprechende Absätze um.
    </p>
    <h4>Modelle zur Auswahl:</h4>
    
    <details>
        <summary><b>Gemini 2.5 Flash / ChatGPT 4o-mini</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★★★</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★★★</td></tr>
        </table>
    </details>

    <details>
        <summary><b>Claude Sonnet 3.5 / 3.7</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★★☆</td></tr>
        </table>
    </details>

    <details>
        <summary><b>ChatGPT 4o</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★★</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★☆☆</td></tr>
        </table>
    </details>

    <details>
        <summary><b>Gemini 2.5 Pro / Claude Sonnet 4 / ChatGPT 4.1</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★★★</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★★★</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★★</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★☆☆☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★☆☆☆</td></tr>
        </table>
    </details>
  `,
  seoVeredler : `
  <p>
        Der <b>SEO-Veredler</b> ist der "Innenausstatter". Er nimmt den fertig geschriebenen Text und arbeitet die sekundären Keywords subtil und natürlich ein, ohne den Stil oder die Struktur zu zerstören.
    </p>
    <h4>Modelle zur Auswahl:</h4>
    
    <details>
        <summary><b>ChatGPT 4o</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★★★</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★★</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★☆☆</td></tr>
        </table>
    </details>
    
    <details>
        <summary><b>Claude 3.5 Sonnet</b></summary>
        <table class="model-table">
            <tr><td class="category">Kreativität & Stil:</td><td>★★★★★</td></tr>
            <tr><td class="category">Logik & Reasoning:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★☆☆</td></tr>
        </table>
    </details>
  `,
  seoAuditor  : `
  <p>
        Der <b>SEO Auditor</b> ist die unbestechliche "Endkontrolle". Er prüft den finalen Text anhand einer harten Checkliste und fällt ein maschinenlesbares Urteil (`approved`/`rejected`).
    </p>
    <h4>Modelle zur Auswahl:</h4>

    <details>
        <summary><b>Gemini 2.5 Pro</b></summary>
        <table class="model-table">
            <tr><td class="category">Logik & Reasoning:</td><td>★★★★★</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★★</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★☆☆☆</td></tr>
        </table>
    </details>

    <details>
        <summary><b>ChatGPT 4o-mini</b></summary>
        <table class="model-table">
            <tr><td class="category">Logik & Reasoning:</td><td>★★★☆☆</td></tr>
            <tr><td class="category">Zuverlässigkeit & Regel-Treue:</td><td>★★★★☆</td></tr>
            <tr><td class="category">Geschwindigkeit:</td><td>★★★★★</td></tr>
            <tr><td class="category">Kosten-Effizienz:</td><td>★★★★★</td></tr>
        </table>
    </details>
  `
};
