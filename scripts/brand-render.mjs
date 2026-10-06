// Rasterizes the brand SVGs in docs/brand into the PNG icons the app and PWA need.
// Usage: node scripts/brand-render.mjs   (requires `pnpm exec playwright install chromium`)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const brand = "docs/brand";
const jobs = [
  // [source svg, output, size]
  ["homi-logo.svg", "public/icons/icon-192.png", 192],
  ["homi-logo.svg", "public/icons/icon-512.png", 512],
  ["homi-icon-maskable.svg", "public/icons/icon-maskable-512.png", 512],
  ["homi-icon-maskable.svg", "src/app/apple-icon.png", 180], // iOS rounds the corners itself
  ["homi-logo.svg", "src/app/icon.png", 64],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [src, out, size] of jobs) {
  const svg = fs.readFileSync(path.join(brand, src), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", out);
}
await browser.close();

// ---- Distribution exports (docs/brand/export): PNGs for web and decks, vector PDFs for print ----
const exportDir = "docs/brand/export";
fs.mkdirSync(exportDir, { recursive: true });
const b2 = await chromium.launch();
const pg = await b2.newPage({ deviceScaleFactor: 2 });
const pg1 = await b2.newPage({ deviceScaleFactor: 1 }); // social card at its native 1200x630
const exports = [
  // [svg, base name, css width, css height]
  ["homi-social-card.svg", "homi-social-card", 1200, 630],
  ["homi-lockup.svg", "homi-lockup-dark", 372, 120],
  ["homi-lockup-light.svg", "homi-lockup-light", 372, 120],
  ["homi-wordmark.svg", "homi-wordmark-dark", 239, 100],
  ["homi-wordmark-light.svg", "homi-wordmark-light", 239, 100],
  ["homi-mark.svg", "homi-mark-dark", 168, 168],
  ["homi-mark-light.svg", "homi-mark-light", 168, 168],
];
for (const [svgFile, name, w, h] of exports) {
  const svg = fs.readFileSync(path.join(brand, svgFile), "utf8");
  const html = `<style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svg}`;
  const target = name === "homi-social-card" ? pg1 : pg;
  await target.setViewportSize({ width: w, height: h });
  await target.setContent(html);
  await target.screenshot({ path: `${exportDir}/${name}.png`, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  if (name !== "homi-social-card") await pg.pdf({ path: `${exportDir}/${name}.pdf`, width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: "1" });
  console.log("wrote", `${exportDir}/${name}`);
}
await b2.close();
