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
