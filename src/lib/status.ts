import type { Status } from "./types";

export interface StatusItem { status: Status; maintenance: boolean }

/** One-line verdict for the public status page. Services in maintenance don't count against it. */
export function banner(items: StatusItem[]): { tone: "ok" | "warn" | "down"; text: string } {
  const live = items.filter((s) => !s.maintenance);
  const down = live.filter((s) => s.status === "down").length, degraded = live.filter((s) => s.status === "degraded").length;
  if (live.length && down === live.length) return { tone: "down", text: "Major outage" };
  if (down) return { tone: "down", text: `${down} ${down === 1 ? "service is" : "services are"} down` };
  if (degraded) return { tone: "warn", text: "Some services are degraded" };
  if (items.some((s) => s.maintenance)) return { tone: "warn", text: "Scheduled maintenance in progress" };
  return { tone: "ok", text: "All systems operational" };
}
