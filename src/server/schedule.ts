/** Weekly recurring windows: pure date maths, no database. */
export interface Recurrence { days: number[]; startTime: string; durationMin: number; tz: string }
export interface Occurrence { start: number; end: number }

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekdayName = (d: number) => WEEKDAYS[d];

interface LocalParts { y: number; m: number; d: number; hh: number; mm: number; wd: number }
function localParts(ts: number, tz: string): LocalParts {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23" }).formatToParts(ts);
  const n = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { y: n("year"), m: n("month"), d: n("day"), hh: n("hour"), mm: n("minute"), wd: WEEKDAYS.indexOf(p.find((x) => x.type === "weekday")!.value) };
}

/** Epoch ms of a wall-clock time in `tz` (two passes settle the UTC offset, including across DST changes). */
export function zonedToEpoch(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  let t = asUtc;
  for (let i = 0; i < 2; i++) {
    const l = localParts(t, tz);
    t += asUtc - Date.UTC(l.y, l.m - 1, l.d, l.hh, l.mm);
  }
  return t;
}

/** Occurrences that start within the last two local days or today; enough for windows up to 48 h. */
export function recentOccurrences(r: Recurrence, now: number): Occurrence[] {
  const today = localParts(now, r.tz);
  const [hh, mm] = r.startTime.split(":").map(Number);
  const out: Occurrence[] = [];
  for (let back = 2; back >= 0; back--) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d - back));
    const wd = (today.wd - back + 7) % 7;
    if (!r.days.includes(wd)) continue;
    const start = zonedToEpoch(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm, r.tz);
    out.push({ start, end: start + r.durationMin * 60_000 });
  }
  return out;
}

export const activeOccurrence = (r: Recurrence, now: number) => recentOccurrences(r, now).find((o) => o.start <= now && now < o.end) ?? null;
export const lastEndedOccurrence = (r: Recurrence, now: number) => recentOccurrences(r, now).filter((o) => o.end <= now).sort((a, b) => b.end - a.end)[0] ?? null;

export function describeRecurrence(r: Recurrence): string {
  const days = r.days.length === 7 ? "Every day" : `Every ${[...r.days].sort((a, b) => a - b).map(weekdayName).join(", ")}`;
  const [hh, mm] = r.startTime.split(":").map(Number);
  const end = (hh * 60 + mm + r.durationMin) % 1440;
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${days} ${r.startTime}–${f(end)} (${r.tz})`;
}
