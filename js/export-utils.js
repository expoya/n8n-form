// js/export-utils.js
import { state } from './state.js';

/**
 * CSV-Header exakt wie im Musterfile (erste Tabellenzeile).
 * Quelle: expoya_import_Musterfile.xlsx (1. Sheet, 21 Spalten)
 */
const CSV_HEADERS = [
  'ObjectID',
  'SKU',
  'EAN',
  'Title',
  'Slug',
  'ShopType',
  'Currency',
  'Price',
  'HasSpecialprice',
  'PriceBefore',
  'IsOutOfStock',
  'Description',
  'ProductLink',
  'Image',
  'Image.1',
  'Image.2',
  'Image.3',
  'Image.4',
  'Tag',
  'Tag.1',
  'Tag.2'
];

/**
 * Default-Bild wie bisher (ident mit deinem XML-Export).
 * Siehe expoya_import_2025-08-17-07-05-43.xml → <Image>…defaultbild.png</Image>
 */
const DEFAULT_IMAGE_URL = 'https://business.expoya.com/images/Default/defaultbild.png'; // :contentReference[oaicite:0]{index=0}

/**
 * Excel/DE-AT freundlich: Semikolon-Delimiter und UTF-8 mit BOM.
 * Zeilenenden CRLF für bessere Excel-Kompatibilität.
 */
const CSV_DELIMITER = ';';
const EOL = '\r\n';

function escapeCsvValue(val) {
  if (val === null || val === undefined) val = '';
  // Alles in String wandeln
  let s = String(val);

  // Normalize newlines
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Wenn Delimiter, Quote oder Newline enthalten → doppelt quoten
  const mustQuote = s.includes(CSV_DELIMITER) || s.includes('"') || s.includes('\n');
  if (mustQuote) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function slugify(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Akzente entfernen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Baut eine CSV-Zeile (Array in exakt 21 Spalten) für einen Titel/Text.
 */
function buildRowForIndex(idx) {
  const title = (state.titles && state.titles[idx]) || '';
  const html  = (state.texts  && state.texts[idx])  || '';

  // Falls du lieber leeren Slug willst wie in deinem XML, setze slug = ''.
  // Dein bisheriges XML hatte <Slug></Slug> leer, daher default: ''
  const slug = '';

  // Alle erweiterten Shop-Felder bleiben leer (wie im Muster/aktuellen XML).
  // Description: nimmt das bereits gerenderte HTML.
  return [
    '',          // ObjectID
    '',          // SKU
    '',          // EAN
    title,       // Title
    slug,        // Slug
    '',          // ShopType
    '',          // Currency
    '',          // Price
    '',          // HasSpecialprice
    '',          // PriceBefore
    '',          // IsOutOfStock
    html,        // Description (HTML erlaubt)
    '',          // ProductLink
    DEFAULT_IMAGE_URL, // Image
    '',          // Image.1
    '',          // Image.2
    '',          // Image.3
    '',          // Image.4
    '',          // Tag
    '',          // Tag.1
    ''           // Tag.2
  ];
}

/**
 * Baut die gesamte CSV als String.
 */
export function buildCsvFromState() {
  const rows = [];
  // Header
  rows.push(CSV_HEADERS.map(escapeCsvValue).join(CSV_DELIMITER));

  // Datenzeilen (eine pro Titel)
  const len = Array.isArray(state.titles) ? state.titles.length : 0;
  for (let i = 0; i < len; i++) {
    const row = buildRowForIndex(i).map(escapeCsvValue).join(CSV_DELIMITER);
    rows.push(row);
  }

  return rows.join(EOL) + EOL; // Abschluss-CRLF
}

/**
 * Löst den Download einer CSV-Datei aus (UTF-8 mit BOM).
 */
export function triggerCsvDownload() {
  const csv = buildCsvFromState();

  // UTF-8 BOM für Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });

  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const name =
    `expoya_import_${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}` +
    `-${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}.csv`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

/**
 * Optional: Initialisiert die Export-Buttons.
 * – CSV: #exportCsvBtn
 * – XML: (deaktiviert) – wir exportieren nur noch CSV.
 */
export function initExportButtons() {
  const csvBtn = document.getElementById('exportCsvBtn');
  if (csvBtn) {
    csvBtn.style.display = 'inline-block';
    csvBtn.onclick = () => triggerCsvDownload();
  }

  // XML-Button, falls noch im DOM: ausblenden oder entschärfen
  const xmlBtn = document.getElementById('exportXmlBtn');
  if (xmlBtn) {
    xmlBtn.style.display = 'none'; // komplett verstecken
    // Alternativ: xmlBtn.onclick = () => alert('XML-Export wurde entfernt. Bitte CSV verwenden.');
  }
}
