export interface QuietHours { enabled: boolean; start: string; end: string; tz: string; digest: boolean }

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

export const validTimeZone = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

/** Minutes since local midnight in `tz`. */
function localMinutes(now: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** True while `now` is inside the window; a window that crosses midnight (22:00–07:00) is handled. Start == end means no window. */
export function inQuietHours(q: QuietHours | undefined, now = Date.now()): boolean {
  if (!q?.enabled) return false;
  const s = toMin(q.start), e = toMin(q.end);
  if (s === e) return false;
  const t = localMinutes(now, validTimeZone(q.tz) ? q.tz : "UTC");
  return s < e ? t >= s && t < e : t >= s || t < e;
}
