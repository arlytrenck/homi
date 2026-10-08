import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { decryptSecrets, encryptSecrets } from "@/server/crypto/secretbox";
import { safeFetch } from "@/server/net/safeFetch";

export type NotifyKind = "webhook" | "ntfy";
/** Stored form: the URL usually embeds a secret (ntfy topic, Discord/Slack token), so it is sealed. */
export interface StoredNotify { enabled: boolean; kind: NotifyKind; urlSealed: string | null; onRecovery: boolean }
export interface NotifyEvent { kind: "down" | "recovered"; name: string; status: string; previous: string; target?: string; error?: string; downForMs?: number; ts: number }

const AAD = "notifications:url";
const KEY = "notifications";
const g = globalThis as unknown as { __homiNotify?: { ts: number; ok: boolean; error?: string } };

export const lastNotify = () => g.__homiNotify ?? null;
export const sealUrl = (url: string) => encryptSecrets({ url }, AAD);
const openUrl = (sealed: string) => decryptSecrets<{ url: string }>(sealed, AAD).url;

export function readStored(db: Db): StoredNotify | null {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row ? (row.value as StoredNotify) : null;
}
export function writeStored(db: Db, v: StoredNotify) {
  db.insert(settings).values({ key: KEY, value: v as any }).onConflictDoUpdate({ target: settings.key, set: { value: v as any } }).run();
}

const fmtDur = (ms: number) => { const m = Math.round(ms / 60_000); return m < 1 ? "under a minute" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

export function describe(e: NotifyEvent): { title: string; text: string } {
  if (e.kind === "down") return { title: `${e.name} is down`, text: `${e.name} is down${e.error ? `: ${e.error}` : ""}` };
  return { title: `${e.name} recovered`, text: `${e.name} is back ${e.status === "degraded" ? "(degraded)" : "up"}${e.downForMs ? ` after ${fmtDur(e.downForMs)}` : ""}` };
}

export async function deliver(kind: NotifyKind, url: string, e: NotifyEvent): Promise<void> {
  const { title, text } = describe(e);
  const r = kind === "ntfy"
    ? await safeFetch(url, { method: "POST", body: text, headers: { Title: title, Tags: e.kind === "down" ? "rotating_light" : "white_check_mark", Priority: e.kind === "down" ? "high" : "default" }, timeoutMs: 8000 })
    // `text` (Slack/Mattermost) and `content` (Discord) make common chat webhooks work with no template.
    : await safeFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text, event: e.kind, service: e.name, status: e.status, previous: e.previous, target: e.target, error: e.error, downForMs: e.downForMs, ts: e.ts }), timeoutMs: 8000 });
  if (r.status < 200 || r.status >= 300) throw new Error(`Receiver answered ${r.status}`);
}

/** Fire-and-forget: never throws, records the outcome for the Settings page. */
export async function notifyTransition(db: Db, e: NotifyEvent): Promise<void> {
  try {
    const cfg = readStored(db);
    if (!cfg?.enabled || !cfg.urlSealed) return;
    if (e.kind === "recovered" && !cfg.onRecovery) return;
    await deliver(cfg.kind, openUrl(cfg.urlSealed), e);
    g.__homiNotify = { ts: Date.now(), ok: true };
  } catch (err) {
    g.__homiNotify = { ts: Date.now(), ok: false, error: err instanceof Error ? err.message : String(err) };
    console.error("[homi] notification failed:", g.__homiNotify.error);
  }
}

/** Which transitions are worth a message: reaching down, or leaving down. Unknown → anything is startup noise. */
export function classify(prev: string, next: string): "down" | "recovered" | null {
  if (prev === "unknown" || prev === next) return null;
  if (next === "down") return "down";
  if (prev === "down") return "recovered";
  return null;
}
