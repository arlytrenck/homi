import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { integrations, widgets } from "@/server/db/schema";
import { decryptSecrets, encryptSecrets } from "@/server/crypto/secretbox";
import { safeFetch } from "@/server/net/safeFetch";
import { getPlugin, widgetRegistry } from "@/plugins/registry";
import { HttpError, type FieldSpec, type HttpInit, type IntegrationContext, type TestResult, type WidgetOutput } from "@/plugins/sdk";

type IntRow = typeof integrations.$inferSelect;

const g = globalThis as unknown as { __homiScratch?: Map<string, { v: unknown; exp: number }>; __homiWidgetCache?: Map<string, Entry>; __homiInflight?: Map<string, Promise<Entry>> };
const scratch = (g.__homiScratch ??= new Map());
const wcache = (g.__homiWidgetCache ??= new Map<string, Entry>());
const inflight = (g.__homiInflight ??= new Map<string, Promise<Entry>>());

export interface Entry { data?: WidgetOutput; error?: string; ts: number; lastGoodAt?: number }

export const aad = (id: string, type: string) => `${id}:${type}`;

export function sealSecrets(id: string, type: string, secrets: Record<string, string>): string | null {
  const nonEmpty = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v));
  return Object.keys(nonEmpty).length ? encryptSecrets(nonEmpty, aad(id, type)) : null;
}

export function openSecrets(row: Pick<IntRow, "id" | "type" | "secrets">): Record<string, string> {
  if (!row.secrets) return {};
  try { return decryptSecrets<Record<string, string>>(row.secrets, aad(row.id, row.type)); }
  catch { throw new Error("Stored secrets cannot be decrypted (was HOMI_SECRET_KEY changed?). Re-enter them."); }
}

export function buildContext(scope: string, o: { baseUrl: string; config: Record<string, any>; secrets: Record<string, string>; ignoreTls: boolean }): IntegrationContext {
  const base = o.baseUrl.replace(/\/+$/, "");
  const raw: IntegrationContext["raw"] = async (path, init: HttpInit = {}) => {
    const headers: Record<string, string> = { accept: "application/json", ...init.headers };
    let body: string | undefined;
    if (init.form) { body = new URLSearchParams(init.form).toString(); headers["content-type"] = "application/x-www-form-urlencoded"; }
    else if (init.body !== undefined) { body = typeof init.body === "string" ? init.body : JSON.stringify(init.body); if (typeof init.body !== "string") headers["content-type"] = "application/json"; }
    const r = await safeFetch(base + path, { method: init.method ?? "GET", headers, body, ignoreTls: o.ignoreTls, timeoutMs: init.timeoutMs ?? 10_000 });
    return { status: r.status, text: r.text, headers: r.headers, json: <T>() => r.json<T>() };
  };
  return {
    baseUrl: base, config: o.config, secrets: o.secrets, ignoreTls: o.ignoreTls, raw,
    async json(path, init) {
      const r = await raw(path, init);
      if (r.status < 200 || r.status >= 300) throw new HttpError(r.status, r.status === 401 || r.status === 403 ? `Authentication failed (${r.status})` : `Request failed (${r.status})`);
      try { return r.json(); } catch { throw new Error("Unexpected non-JSON response"); }
    },
    cache: {
      get: <T>(k: string) => { const e = scratch.get(`${scope}:${k}`); return e && e.exp > Date.now() ? (e.v as T) : undefined; },
      set: (k, v, ttl) => { scratch.set(`${scope}:${k}`, { v, exp: Date.now() + ttl }); },
    },
  };
}

export const ctxFor = (row: IntRow) => buildContext(row.id, { baseUrl: row.baseUrl, config: row.config, secrets: openSecrets(row), ignoreTls: row.ignoreTls });

export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const code = (e as any)?.cause?.code ?? (e as any)?.code;
  if (code === "ECONNREFUSED") return "Connection refused";
  if (code === "ENOTFOUND") return "Host not found";
  if (code === "ETIMEDOUT" || (e as Error)?.name === "AbortError") return "Timed out";
  if (/self.signed|certificate|UNABLE_TO_VERIFY/i.test(m + code)) return "TLS certificate not trusted (enable “Ignore TLS errors” for self-signed certs)";
  return m;
}

export async function testIntegration(type: string, o: { baseUrl: string; config: Record<string, any>; secrets: Record<string, string>; ignoreTls: boolean }): Promise<TestResult> {
  const p = getPlugin(type);
  if (!p) return { ok: false, error: "Unknown integration type" };
  const bad = validateFields({ ...p.config, ...p.secrets }, { ...o.config, ...o.secrets });
  if (bad) return { ok: false, error: bad };
  try { return await p.test(buildContext(`test:${Math.random()}`, o)); } catch (e) { return { ok: false, error: friendlyError(e) }; }
}

export function validateFields(fields: Record<string, FieldSpec> | undefined, values: Record<string, unknown>): string | null {
  for (const [k, f] of Object.entries(fields ?? {})) {
    const v = values[k];
    const empty = v === undefined || v === null || v === "";
    if (!empty && f.kind === "number" && !Number.isFinite(Number(v))) return `${f.label} must be a number`;
    if (!empty && f.kind === "url" && !/^https?:\/\//i.test(String(v))) return `${f.label} must be an http(s) URL`;
    if ("required" in f && f.required && empty) return `${f.label} is required`;
  }
  return null;
}

/** Cached, single-flight widget data. Never throws; errors are returned alongside the last good data. */
export async function getWidgetData(widgetId: string, force = false): Promise<Entry> {
  const db = getDb();
  const w = db.select().from(widgets).where(eq(widgets.id, widgetId)).get();
  if (!w) return { error: "Widget not found", ts: Date.now() };
  const def = widgetRegistry[w.kind];
  if (!def) return { error: `Unknown widget type “${w.kind}”`, ts: Date.now() };
  const prev = wcache.get(widgetId);
  const ttl = (def.minIntervalS ?? 30) * 1000;
  if (!force && prev && Date.now() - prev.ts < ttl) return prev;
  const running = inflight.get(widgetId);
  if (running) return running;

  const job = (async (): Promise<Entry> => {
    const now = Date.now();
    try {
      const bad = validateFields(def.options, w.options);
      if (bad) throw new Error(bad);
      let data: WidgetOutput;
      if (def.pluginId) {
        const row = w.integrationId ? db.select().from(integrations).where(eq(integrations.id, w.integrationId)).get() : undefined;
        if (!row) throw new Error("Integration missing");
        if (!row.enabled) throw new Error("Integration disabled");
        data = await (def as import("@/plugins/sdk").WidgetDef).fetch(ctxFor(row), w.options);
        db.update(integrations).set({ lastOkAt: now, lastError: null }).where(eq(integrations.id, row.id)).run();
      } else {
        data = await (def as import("@/plugins/sdk").CoreWidgetDef).fetch({ fetchJson: async (url) => { const r = await safeFetch(url, { timeoutMs: 8000 }); if (r.status >= 300) throw new Error(`Request failed (${r.status})`); return r.json(); } }, w.options);
      }
      const e: Entry = { data, ts: now, lastGoodAt: now };
      wcache.set(widgetId, e);
      return e;
    } catch (err) {
      const msg = friendlyError(err);
      if (w.integrationId) db.update(integrations).set({ lastError: msg }).where(eq(integrations.id, w.integrationId)).run();
      const e: Entry = { data: prev?.data, error: msg, ts: now, lastGoodAt: prev?.lastGoodAt };
      wcache.set(widgetId, e);
      return e;
    } finally { inflight.delete(widgetId); }
  })();
  inflight.set(widgetId, job);
  return job;
}

export const dropWidgetCache = (id: string) => wcache.delete(id);
