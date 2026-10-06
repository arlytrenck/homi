// Generates font-independent (outlined) wordmark, lockup and social-card SVGs from Inter.
// Usage: node scripts/brand-outline.mjs   (then node scripts/brand-render.mjs for PNG/PDF exports)
import fs from "node:fs";
import opentype from "opentype.js";

const fontFile = (w) => `node_modules/@fontsource/inter/files/inter-latin-${w}-normal.woff`;
const load = (w) => { const b = fs.readFileSync(fontFile(w)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const bold = load(700), regular = load(400), medium = load(500);

/** Glyph-by-glyph layout with kerning (no OpenType shaping; plenty for Latin brand text). */
function layout(font, text, size, x, y, track = 0) {
  const sc = size / font.unitsPerEm; let cx = x, prev = null; const paths = [];
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    if (prev) cx += font.getKerningValue(prev, g) * sc;
    paths.push(g.getPath(cx, y, size).toPathData(2));
    cx += g.advanceWidth * sc + track * size; prev = g;
  }
  return { d: paths.join(" "), width: cx - x };
}

const SIZE = 88, X0 = 15, BASE = 100, TRACK = -3 / SIZE; // matches the original live-text wordmark
const hom = layout(bold, "hom", SIZE, X0, BASE, TRACK);
const homD = hom.d;
const adv = hom.width;

// The "i" keeps the brand's rounded stem and status dot; stem metrics come from Inter's dotless i.
const dotless = bold.charToGlyph("ı");
const gb = dotless.getBoundingBox(); const s = SIZE / bold.unitsPerEm;
const stemX = +(X0 + adv + gb.x1 * s).toFixed(2), stemW = +((gb.x2 - gb.x1) * s).toFixed(2), stemH = +((gb.y2 - gb.y1) * s).toFixed(2);
const stemY = +(BASE - gb.y2 * s).toFixed(2);
const dotCx = +(stemX + stemW / 2).toFixed(2), dotCy = +(stemY - 16).toFixed(2);
const W = Math.ceil(stemX + stemW + 25);

const pal = {
  dark: { a: "#2dd4bf", b: "#6366f1", dot: "#2dd4bf" },
  light: { a: "#0d9488", b: "#4f46e5", dot: "#0d9488" },
};
const wordmarkInner = (id, c, mono) => {
  const fill = mono ? "currentColor" : `url(#${id})`;
  const defs = mono ? "" : `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${X0}" y1="0" x2="${stemX + stemW}" y2="0"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></linearGradient></defs>`;
  const dot = mono ? "currentColor" : c.dot;
  return `${defs}<path d="${homD}" fill="${fill}"/><rect x="${stemX}" y="${stemY}" width="${stemW}" height="${stemH}" rx="3" fill="${fill}"/><circle cx="${dotCx}" cy="${dotCy}" r="12" fill="${dot}" fill-opacity="0.18"/><circle cx="${dotCx}" cy="${dotCy}" r="6" fill="${dot}"/>`;
};
const out = (f, s) => { fs.writeFileSync(`docs/brand/${f}`, s); console.log("wrote", f); };
const wordmark = (c, mono = false) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 12 ${W} 100" width="${W * 4}" height="400" role="img">\n  <title>Homi</title>\n  ${wordmarkInner("wm", c, mono)}\n</svg>\n`;
out("homi-wordmark.svg", wordmark(pal.dark));
out("homi-wordmark-light.svg", wordmark(pal.light));
out("homi-wordmark-mono.svg", wordmark(pal.dark, true));

// Lockups: tile + outlined wordmark
const HOUSE = "M28 60 L60 32 L92 60 M38 51.25 V88 H82 V51.25";
const tile = `<rect x="0.5" y="0.5" width="119" height="119" rx="27.5" fill="url(#bg)" stroke="#334155" stroke-opacity="0.7"/><path d="${HOUSE}" fill="none" stroke="url(#hg)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="67" r="11" fill="#2dd4bf" fill-opacity="0.18"/><circle cx="60" cy="67" r="5.5" fill="#2dd4bf"/>`;
const tileDefs = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0b1020"/></linearGradient><linearGradient id="hg" gradientUnits="userSpaceOnUse" x1="28" y1="32" x2="92" y2="88"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#6366f1"/></linearGradient>`;
const LW = 132 + W;
const lockupBody = (c, id) => `<defs>${tileDefs}</defs>${tile}<svg x="132" y="4" width="${W}" height="100" viewBox="0 12 ${W} 100">${wordmarkInner(id, c, false)}</svg>`;
const lockup = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LW} 120" width="${LW * 2}" height="240" role="img">\n  <title>Homi</title>\n  ${lockupBody(c, "wm")}\n</svg>\n`;
out("homi-lockup.svg", lockup(pal.dark));
out("homi-lockup-light.svg", lockup(pal.light));

// Social card 1200x630 (Open Graph / Twitter), all text outlined
const textPath = (font, text, size, x, y, anchor = "start", track = 0) => {
  const w = layout(font, text, size, 0, 0, track).width;
  return layout(font, text, size, anchor === "middle" ? x - w / 2 : x, y, track).d;
};
const sc = 2.4, lw = LW * sc, lx = (1200 - lw) / 2, ly = 112;
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img">
  <title>Homi: a dashboard for your homelab</title>
  <defs><linearGradient id="ogbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111a2e"/><stop offset="1" stop-color="#0b1020"/></linearGradient><linearGradient id="ogbar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#6366f1"/></linearGradient>${tileDefs}</defs>
  <rect width="1200" height="630" fill="url(#ogbg)"/>
  <g transform="translate(${lx.toFixed(1)} ${ly}) scale(${sc})">${lockupBody(pal.dark, "wm")}</g>
  <path d="${textPath(regular, "A dashboard for your homelab.", 46, 600, 468, "middle")}" fill="#cbd5e1"/>
  <path d="${textPath(medium, "self-hosted  /  at a glance  /  yours", 26, 600, 528, "middle", 0.04)}" fill="#94a3b8"/>
  <rect x="0" y="618" width="1200" height="12" fill="url(#ogbar)"/>
</svg>
`;
out("homi-social-card.svg", og);
console.log({ W, LW, stemX, stemW, stemH, stemY });
