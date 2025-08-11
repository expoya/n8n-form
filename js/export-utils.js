// js/export-utils.js
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

export function downloadFile(filename, text) {
  const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
