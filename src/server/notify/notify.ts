import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { decryptSecrets, encryptSecrets } from "@/server/crypto/secretbox";
import { safeFetch } from "@/server/net/safeFetch";

export type NotifyKind = "webhook" | "ntfy";
/** Stored form: the URL usually embeds a secret (ntfy topic, Discord/Slack token), so it is sealed. */
export interface Destination { id: string; kind: NotifyKind; urlSealed: string | null; enabled: boolean; onRecovery: boolean; /** empty/absent = every service; otherwise only these groups ("__none__" = ungrouped) */ groupIds?: string[] }
export interface NotifyEvent { groupId?: string | null; kind: "down" | "recovered"; name: string; status: string; previous: string; target?: string; error?: string; downForMs?: number; ts: number }
export interface DeliveryResult { ts: number; ok: boolean; error?: string }

const AAD = "notifications:url";
const KEY = "notifications";
const g = globalThis as unknown as { __homiNotify?: Record<string, DeliveryResult> };

export const lastResults = (): Record<string, DeliveryResult> => g.__homiNotify ?? {};
export const sealUrl = (url: string) => encryptSecrets({ url }, AAD);
export const openUrl = (sealed: string) => decryptSecrets<{ url: string }>(sealed, AAD).url;

/** Reads destinations; a pre-multi-destination setting (one object) becomes a single destination. */
export function readDestinations(db: Db): Destination[] {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  const v = row?.value as { destinations?: Destination[]; kind?: NotifyKind; urlSealed?: string | null; enabled?: boolean; onRecovery?: boolean } | undefined;
  if (!v) return [];
  if (Array.isArray(v.destinations)) return v.destinations;
  return v.kind ? [{ id: "d1", kind: v.kind, urlSealed: v.urlSealed ?? null, enabled: !!v.enabled, onRecovery: v.onRecovery ?? true }] : [];
}
export const UNGROUPED = "__none__";
export const routesTo = (d: Pick<Destination, "groupIds">, groupId: string | null | undefined) => !d.groupIds?.length || d.groupIds.includes(groupId ?? UNGROUPED);

/** A deleted group must not leave a destination silently scoped to nothing. */
export function pruneGroup(db: Db, groupId: string) {
  const all = readDestinations(db);
  if (!all.some((d) => d.groupIds?.includes(groupId))) return;
  writeDestinations(db, all.map((d) => (d.groupIds?.includes(groupId) ? { ...d, groupIds: d.groupIds.filter((id) => id !== groupId) } : d)));
}

export function writeDestinations(db: Db, destinations: Destination[]) {
  const value = { destinations } as any;
  db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
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

/** Fire-and-forget: never throws; each destination is independent and its outcome is recorded for the Settings page. */
export async function notifyTransition(db: Db, e: NotifyEvent): Promise<void> {
  let dests: Destination[];
  try { dests = readDestinations(db).filter((d) => d.enabled && d.urlSealed && (e.kind === "down" || d.onRecovery) && routesTo(d, e.groupId)); } catch { return; }
  await Promise.all(dests.map(async (d) => {
    try { await deliver(d.kind, openUrl(d.urlSealed!), e); (g.__homiNotify ??= {})[d.id] = { ts: Date.now(), ok: true }; }
    catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      (g.__homiNotify ??= {})[d.id] = { ts: Date.now(), ok: false, error };
      console.error(`[homi] notification to ${d.kind} destination failed:`, error);
    }
  }));
}

/** Which transitions are worth a message: reaching down, or leaving down. Unknown → anything is startup noise. */
export function classify(prev: string, next: string): "down" | "recovered" | null {
  if (prev === "unknown" || prev === next) return null;
  if (next === "down") return "down";
  if (prev === "down") return "recovered";
  return null;
}
