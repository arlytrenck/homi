import os from "node:os";
import fs from "node:fs/promises";
import { bytes, clamp01, defineCoreWidget, duration } from "../sdk";

const WMO: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm" };

export const weather = defineCoreWidget({
  id: "core.weather", title: "Weather",
  options: {
    lat: { kind: "number", label: "Latitude", required: true }, lon: { kind: "number", label: "Longitude", required: true },
    units: { kind: "select", label: "Units", options: [{ value: "metric", label: "Metric (°C)" }, { value: "imperial", label: "Imperial (°F)" }] },
  },
  minIntervalS: 600,
  async fetch(ctx, o) {
    const lat = Number(o.lat), lon = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Set latitude and longitude");
    const imp = o.units === "imperial";
    const d = await ctx.fetchJson<any>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=${imp ? "fahrenheit" : "celsius"}&wind_speed_unit=${imp ? "mph" : "kmh"}`);
    const c = d.current;
    return { stats: [{ label: WMO[c.weather_code] ?? "Weather", value: `${Math.round(c.temperature_2m)}°${imp ? "F" : "C"}` }, { label: "Wind", value: `${Math.round(c.wind_speed_10m)} ${imp ? "mph" : "km/h"}` }, { label: "Humidity", value: `${c.relative_humidity_2m}%` }] };
  },
});

export const notes = defineCoreWidget({
  id: "core.notes", title: "Notes", options: { text: { kind: "textarea", label: "Text" } }, minIntervalS: 5,
  async fetch(_c, o) { return { note: String(o.text ?? "") || "Empty note. Edit this widget to add text." }; },
});

export const bookmarks = defineCoreWidget({
  id: "core.bookmarks", title: "Bookmarks", minIntervalS: 5,
  options: { links: { kind: "textarea", label: "One per line: Name | https://url", required: true } },
  async fetch(_c, o) {
    const rows = String(o.links ?? "").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter(([n, u]) => n && u && /^https?:\/\//i.test(u)).map(([n, u]) => ({ primary: n, secondary: new URL(u).host, href: u }));
    return { rows };
  },
});

export const hoststats = defineCoreWidget({
  id: "core.hoststats", title: "Host", minIntervalS: 5,
  options: { path: { kind: "text", label: "Disk path to report", placeholder: "/" } },
  async fetch(_c, o) {
    const cpus = os.cpus().length, load = os.loadavg()[0] / cpus;
    const total = os.totalmem(), used = total - os.freemem();
    const meters = [{ label: "Load (1 min)", value: clamp01(load), text: `${os.loadavg()[0].toFixed(2)} on ${cpus} cores` }, { label: "Memory", value: clamp01(used / total), text: `${bytes(used)} / ${bytes(total)}` }];
    try { const s = await fs.statfs(String(o.path || "/")); const t = s.blocks * s.bsize, u = t - s.bfree * s.bsize; meters.push({ label: `Disk ${o.path || "/"}`, value: clamp01(u / t), text: `${bytes(u)} / ${bytes(t)}` }); } catch { /* path unavailable */ }
    return { meters, note: `${os.hostname()} · up ${duration(os.uptime())} · inside the container unless /proc and disks are mounted` };
  },
});

export const coreWidgets = [weather, notes, bookmarks, hoststats];
