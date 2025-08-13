// js/export-utils.js/
import { state } from './state.js';

const DEFAULT_IMG = "https://business.expoya.com/images/Default/defaultbild.png";

function xmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildCsvFromState() {
  const company = (state.companyData?.companyName || state.companyData?.Unternehmen || '').toString();
  const datum = new Date().toLocaleDateString('de-AT');
  const titles = Array.isArray(state.titles) ? state.titles : [];
  const texts  = Array.isArray(state.texts)  ? state.texts  : [];

  const htmlToText = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || '').replace(/\r\n/g,'\n'); // normalize.
  };

  const csvEscape = (s) => {
    const v = (s ?? '').toString();
    // Semikolon-Trenner (DE/AT-Excel-freundlich)
    if (/[\";\n\r]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };

  const sep = ';';
  const header = ['Unternehmen','Datum','Titel','Text'].map(csvEscape).join(sep);
  const rows = titles.map((title, i) => {
    const textPlain = htmlToText(texts[i] || '');
    return [csvEscape(company), csvEscape(datum), csvEscape(title || ''), csvEscape(textPlain)].join(sep);
  });
  return header + '\n' + rows.join('\n');
}


export function buildXmlFromState({ onlyWithText = false } = {}) {
  const titles = Array.isArray(state.titles) ? state.titles : [];
  const texts  = Array.isArray(state.texts)  ? state.texts  : [];

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<Items>`;
  const footer = `\n</Items>`;

  const rows = titles
    .map((title, i) => ({ title, html: texts[i] || '' }))
    .filter(row => !onlyWithText || row.html.trim() !== '')
    .map(({ title, html }) => {
      const titleEsc = xmlEscape(title || "");
      const description = `<![CDATA[${html}]]>`;
      return [
        "  <Item>",
        `    <ObjectID></ObjectID>`,
        `    <SKU></SKU>`,
        `    <EAN></EAN>`,
        `    <Title>${titleEsc}</Title>`,
        `    <Slug></Slug>`,
        `    <ShopType></ShopType>`,
        `    <Currency></Currency>`,
        `    <Price></Price>`,
        `    <HasSpecialprice></HasSpecialprice>`,
        `    <PriceBefore></PriceBefore>`,
        `    <IsOutOfStock></IsOutOfStock>`,
        `    <Description>${description}</Description>`,
        `    <ProductLink></ProductLink>`,
        `    <Image>${xmlEscape(DEFAULT_IMG)}</Image>`,
        `    <Image.1></Image.1>`,
        `    <Image.2></Image.2>`,
        `    <Image.3></Image.3>`,
        `    <Image.4></Image.4>`,
        `    <Tag></Tag>`,
        `    <Tag.1></Tag.1>`,
        `    <Tag.2></Tag.2>`,
        "  </Item>"
      ].join("\n");
    });

  return header + "\n" + rows.join("\n") + footer;
}

  export function downloadFile(filename, text, mime = "application/xml;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
