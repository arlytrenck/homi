import type { CoreWidgetDef, IntegrationPlugin } from "./types";
export * from "./types";

/** Identity helpers that give authors type inference. */
export const definePlugin = (p: IntegrationPlugin) => p;
export const defineCoreWidget = (w: CoreWidgetDef) => w;

export const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
export const num = (n: number | undefined | null) => (n == null ? "–" : Math.round(n).toLocaleString("en-US"));
export const pct = (n: number | undefined | null, digits = 0) => (n == null ? "–" : `${n.toFixed(digits)}%`);
export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function bytes(n: number | undefined | null): string {
  if (n == null) return "–";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

export function duration(sec: number | undefined | null): string {
  if (sec == null) return "–";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
