// Generates every brand SVG in docs/brand from one definition: mark, tile, wordmark, lockups,
// banner and social card. All text is outlined (Inter, JetBrains Mono), so files render the same everywhere.
// Usage: node scripts/brand-outline.mjs   (then node scripts/brand-render.mjs for PNG/PDF exports)
import fs from "node:fs";
import opentype from "opentype.js";

const load = (pkg, w) => { const b = fs.readFileSync(`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff`); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const bold = load("inter", 700), regular = load("inter", 400), mono = load("jetbrains-mono", 500);

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
const textPath = (font, text, size, x, y, anchor = "start", track = 0) => {
  const w = layout(font, text, size, 0, 0, track).width;
  return layout(font, text, size, anchor === "middle" ? x - w / 2 : x, y, track).d;
};

// Palettes: one accent (teal), one ink. No gradients.
const pal = {
  dark: { ink: "#f1f5f9", teal: "#2dd4bf" },
  light: { ink: "#0b1020", teal: "#0d9488" },
};
const NAVY = "#0b1020";

// ---- Mark (120 box): a roof over a 2x2 grid of services. The grid is the house; one service is live ----
const ROOF = "M27 49 L60 24 L93 49", ROOF_W = 10;
const CELL = 21, CELL_R = 5, CELLS = [[36, 54], [63, 54], [36, 81], [63, 81]]; // 6px gap
const LIT = 1; // top-right, echoing the dot of the i
const markInner = (c, monoColor) => {
  const ink = monoColor ? "currentColor" : c.ink, lit = monoColor ? "currentColor" : c.teal;
  const cells = CELLS.map(([x, y], i) => `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="${CELL_R}" fill="${i === LIT ? lit : ink}"/>`).join("");
  return `<path d="${ROOF}" fill="none" stroke="${ink}" stroke-width="${ROOF_W}" stroke-linecap="round" stroke-linejoin="round"/>${cells}`;
};
const MARK_VB = "16 16.5 88 88"; // artwork spans x 22..98, y 19..102
const out = (f, s) => { fs.writeFileSync(`docs/brand/${f}`, s); console.log("wrote", f); };
const svg = (vb, w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}" role="img">\n  <title>${title}</title>\n  ${body}\n</svg>\n`;

out("homi-mark.svg", svg(MARK_VB, 512, 512, "Homi", markInner(pal.dark)));
out("homi-mark-light.svg", svg(MARK_VB, 512, 512, "Homi", markInner(pal.light)));
out("homi-mark-mono.svg", svg(MARK_VB, 512, 512, "Homi", markInner(pal.dark, true)));

const tileSvg = markInner(pal.dark);
out("homi-logo.svg", svg("0 0 120 120", 512, 512, "Homi", `<rect width="120" height="120" rx="28" fill="${NAVY}"/>${tileSvg}`));
// Maskable: full bleed, mark scaled into the 80% safe zone
out("homi-icon-maskable.svg", svg("0 0 120 120", 512, 512, "Homi", `<rect width="120" height="120" fill="${NAVY}"/><g transform="translate(15 14.6) scale(0.75)">${tileSvg}</g>`));

// ---- Wordmark: Inter Bold "hom" + dotless i, dotted with the brand square ----
const SIZE = 88, X0 = 15, BASE = 100, TRACK = -3 / SIZE;
const hom = layout(bold, "hom", SIZE, X0, BASE, TRACK);
const dotless = bold.charToGlyph("ı");
const gb = dotless.getBoundingBox(); const s = SIZE / bold.unitsPerEm;
const stem = dotless.getPath(X0 + hom.width, BASE, SIZE).toPathData(2);
const stemX = X0 + hom.width + gb.x1 * s, stemW = (gb.x2 - gb.x1) * s, stemY = BASE - gb.y2 * s;
const D = 15, DOT_GAP = 6; // dot square, same 25% corner radius as the mark cells
const dotX = +(stemX + stemW / 2 - D / 2).toFixed(2), dotY = +(stemY - D - DOT_GAP).toFixed(2);
const W = Math.ceil(stemX + stemW + 15);
const wordInner = (c, monoColor) => {
  const ink = monoColor ? "currentColor" : c.ink, lit = monoColor ? "currentColor" : c.teal;
  return `<path d="${hom.d} ${stem}" fill="${ink}"/><rect x="${dotX}" y="${dotY}" width="${D}" height="${D}" rx="${D / 4}" fill="${lit}"/>`;
};
out("homi-wordmark.svg", svg(`0 12 ${W} 100`, W * 4, 400, "Homi", wordInner(pal.dark)));
out("homi-wordmark-light.svg", svg(`0 12 ${W} 100`, W * 4, 400, "Homi", wordInner(pal.light)));
out("homi-wordmark-mono.svg", svg(`0 12 ${W} 100`, W * 4, 400, "Homi", wordInner(pal.dark, true)));

// ---- Lockup: bare mark + wordmark. The grid sits on the baseline (y=102); 34px clear space left and right ----
const LW = 132 + W, MX = 12, WX = 113, WY = 14;
const lockupBody = (c) => `<g transform="translate(${MX} 0)">${markInner(c)}</g><svg x="${WX}" y="${WY}" width="${W}" height="100" viewBox="0 12 ${W} 100">${wordInner(c)}</svg>`;
out("homi-lockup.svg", svg(`0 0 ${LW} 120`, LW * 2, 240, "Homi", lockupBody(pal.dark)));
out("homi-lockup-light.svg", svg(`0 0 ${LW} 120`, LW * 2, 240, "Homi", lockupBody(pal.light)));

// ---- Shared bits for the 1280x640 banner and the 1200x630 social card ----
const TAG = "A dashboard for your homelab.", DESC = "self-hosted  /  at a glance  /  yours";
const INK_L = MX + 22; // left edge of the lockup artwork, for aligning text under it
// A field of service cells that can bleed off the canvas; fade(col, row) gives the idle-cell opacity
const field = (x0, y0, pitch, cols, rows, lit, fade) => {
  const cell = pitch * 0.78; let o = "";
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const on = lit.some(([a, b]) => a === k && b === r);
    const op = +(fade(k, r) * (0.75 + ((k * 3 + r * 5) % 4) * 0.12)).toFixed(3);
    o += `<rect x="${x0 + k * pitch}" y="${y0 + r * pitch}" width="${cell}" height="${cell}" rx="${cell / 4}" fill="${on ? pal.dark.teal : pal.dark.ink}"${on ? "" : ` fill-opacity="${op}"`}/>`;
  }
  return o;
};

// Banner: left-aligned lockup and copy; the service field bleeds off the right edge
{
  const sc = 2.1, tx = 96, lx = tx - INK_L * sc, ly = 113;
  out("homi-banner.svg", svg("0 0 1280 640", 1280, 640, "Homi: a dashboard for your homelab", `<rect width="1280" height="640" fill="${NAVY}"/>
  ${field(848, -28, 76, 6, 10, [[4, 2], [2, 5]], (k) => 0.012 + k * 0.02)}
  <g transform="translate(${lx.toFixed(1)} ${ly}) scale(${sc})">${lockupBody(pal.dark)}</g>
  <path d="${textPath(regular, TAG, 44, tx, 431)}" fill="#cbd5e1"/>
  <path d="${textPath(mono, DESC, 24, tx, 487, "start", 0.02)}" fill="#94a3b8"/>`));
}

// Social card: centered lockup, tagline, descriptor, a row of cells along the bottom edge
{
  const sc = 2.4, lw = LW * sc, lx = (1200 - lw) / 2, ly = 84;
  out("homi-social-card.svg", svg("0 0 1200 630", 1200, 630, "Homi: a dashboard for your homelab", `<rect width="1200" height="630" fill="${NAVY}"/>
  ${field(-30, 566, 76, 17, 1, [[12, 0]], () => 0.07)}
  <g transform="translate(${lx.toFixed(1)} ${ly}) scale(${sc})">${lockupBody(pal.dark)}</g>
  <path d="${textPath(regular, TAG, 46, 600, 436, "middle")}" fill="#cbd5e1"/>
  <path d="${textPath(mono, DESC, 26, 600, 496, "middle", 0.02)}" fill="#94a3b8"/>`));
}
console.log({ W, LW, dotX, dotY });
