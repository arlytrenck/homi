import "server-only";
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { checks, services, settings } from "@/server/db/schema";
import { decryptSecrets, encryptSecrets } from "@/server/crypto/secretbox";
import { safeFetch } from "@/server/net/safeFetch";
import { inQuietHours, type QuietHours } from "./quiet";

export type NotifyKind = "webhook" | "ntfy";
/** Stored form: the URL usually embeds a secret (ntfy topic, Discord/Slack token), so it is sealed. */
export interface Destination { id: string; kind: NotifyKind; urlSealed: string | null; enabled: boolean; onRecovery: boolean; /** empty/absent = every service; otherwise only these groups ("__none__" = ungrouped) */ groupIds?: string[]; /** with groupIds: a service matching either selector is routed here (case-insensitive) */ tags?: string[]; /** alerts are held back inside this window; optionally one summary follows when it ends */ quiet?: QuietHours }
export interface NotifyEvent { groupId?: string | null; tags?: string[]; /** names of services still down (digest only) */ services?: string[]; kind: "down" | "recovered" | "digest"; name: string; status: string; previous: string; target?: string; error?: string; downForMs?: number; ts: number }
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
export function routesTo(d: Pick<Destination, "groupIds" | "tags">, groupId: string | null | undefined, tags: string[] = []): boolean {
  const g = d.groupIds ?? [], t = (d.tags ?? []).map((x) => x.toLowerCase());
  if (!g.length && !t.length) return true;
  return g.includes(groupId ?? UNGROUPED) || tags.some((x) => t.includes(x.toLowerCase()));
}

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
  if (e.kind === "digest") { const n = e.services?.length ?? 0; return { title: `${n} service${n === 1 ? "" : "s"} still down`, text: `Quiet hours ended. Still down: ${(e.services ?? []).join(", ")}` }; }
  if (e.kind === "down") return { title: `${e.name} is down`, text: `${e.name} is down${e.error ? `: ${e.error}` : ""}` };
  return { title: `${e.name} recovered`, text: `${e.name} is back ${e.status === "degraded" ? "(degraded)" : "up"}${e.downForMs ? ` after ${fmtDur(e.downForMs)}` : ""}` };
}

export async function deliver(kind: NotifyKind, url: string, e: NotifyEvent): Promise<void> {
  const { title, text } = describe(e);
  const r = kind === "ntfy"
    ? await safeFetch(url, { method: "POST", body: text, headers: { Title: title, Tags: e.kind === "recovered" ? "white_check_mark" : "rotating_light", Priority: e.kind === "recovered" ? "default" : "high" }, timeoutMs: 8000 })
    // `text` (Slack/Mattermost) and `content` (Discord) make common chat webhooks work with no template.
    : await safeFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text, event: e.kind, service: e.name, status: e.status, previous: e.previous, target: e.target, error: e.error, downForMs: e.downForMs, services: e.services, ts: e.ts }), timeoutMs: 8000 });
  if (r.status < 200 || r.status >= 300) throw new Error(`Receiver answered ${r.status}`);
}

/** Fire-and-forget: never throws; each destination is independent and its outcome is recorded for the Settings page. */
export async function notifyTransition(db: Db, e: NotifyEvent): Promise<void> {
  let dests: Destination[];
  try { dests = readDestinations(db).filter((d) => d.enabled && d.urlSealed && (e.kind !== "recovered" || d.onRecovery) && routesTo(d, e.groupId, e.tags) && !inQuietHours(d.quiet)); } catch { return; }
  await Promise.all(dests.map(async (d) => {
    try { await deliver(d.kind, openUrl(d.urlSealed!), e); (g.__homiNotify ??= {})[d.id] = { ts: Date.now(), ok: true }; }
    catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      (g.__homiNotify ??= {})[d.id] = { ts: Date.now(), ok: false, error };
      console.error(`[homi] notification to ${d.kind} destination failed:`, error);
    }
  }));
}

const quietState = ((globalThis as unknown as { __homiQuiet?: Map<string, number | null> }).__homiQuiet ??= new Map());

/**
 * Call about once a minute. When a destination's quiet window has just ended, send one summary of
 * routed, unmuted services that went down during it and are still down. In-memory: a restart inside
 * the window forgets the window start, so the summary then covers the last 12 hours.
 */
export async function digestTick(db: Db, now = Date.now()): Promise<void> {
  let dests: Destination[];
  try { dests = readDestinations(db); } catch { return; }
  for (const d of dests) {
    if (!d.quiet?.enabled) { quietState.delete(d.id); continue; }
    const quiet = inQuietHours(d.quiet, now);
    const startedAt = quietState.get(d.id); // number = inside window since; null = outside; undefined = unknown
    quietState.set(d.id, quiet ? startedAt ?? (startedAt === null ? now : now - 12 * 3600_000) : null);
    if (quiet || startedAt == null || !d.quiet.digest || !d.enabled || !d.urlSealed) continue;
    const since = startedAt;
    const down = db.select({ name: services.name, muted: services.alertsMuted, groupId: services.groupId, tags: services.tags }).from(checks)
      .innerJoin(services, eq(services.id, checks.serviceId)).where(and(eq(checks.lastStatus, "down"), gte(checks.lastChangeAt, since))).all()
      .filter((s) => !s.muted && routesTo(d, s.groupId, s.tags));
    if (!down.length) continue;
    try { await deliver(d.kind, openUrl(d.urlSealed), { kind: "digest", name: "Homi", status: "down", previous: "down", services: down.map((s) => s.name), ts: now }); (g.__homiNotify ??= {})[d.id] = { ts: now, ok: true }; }
    catch (err) { (g.__homiNotify ??= {})[d.id] = { ts: now, ok: false, error: err instanceof Error ? err.message : String(err) }; }
  }
}

/** Which transitions are worth a message: reaching down, or leaving down. Unknown → anything is startup noise. */
export function classify(prev: string, next: string): "down" | "recovered" | null {
  if (prev === "unknown" || prev === next) return null;
  if (next === "down") return "down";
  if (prev === "down") return "recovered";
  return null;
}
