import { describe, it, expect } from "vitest";
import { inQuietHours, validTimeZone, type QuietHours } from "./quiet";

const q = (o: Partial<QuietHours> = {}): QuietHours => ({ enabled: true, start: "22:00", end: "07:00", tz: "UTC", digest: true, ...o });
const at = (iso: string) => Date.parse(iso);

describe("inQuietHours", () => {
  it("handles a window that crosses midnight", () => {
    expect(inQuietHours(q(), at("2026-01-10T23:30:00Z"))).toBe(true);
    expect(inQuietHours(q(), at("2026-01-10T03:00:00Z"))).toBe(true);
    expect(inQuietHours(q(), at("2026-01-10T07:00:00Z"))).toBe(false); // end is exclusive
    expect(inQuietHours(q(), at("2026-01-10T12:00:00Z"))).toBe(false);
    expect(inQuietHours(q(), at("2026-01-10T22:00:00Z"))).toBe(true); // start is inclusive
  });
  it("handles a same-day window", () => {
    const w = q({ start: "09:00", end: "17:00" });
    expect(inQuietHours(w, at("2026-01-10T09:00:00Z"))).toBe(true);
    expect(inQuietHours(w, at("2026-01-10T17:00:00Z"))).toBe(false);
  });
  it("evaluates in the configured time zone, including DST", () => {
    const berlin = q({ tz: "Europe/Berlin" }); // UTC+1 in winter, UTC+2 in summer
    expect(inQuietHours(berlin, at("2026-01-10T20:30:00Z"))).toBe(false); // 21:30 local in winter
    expect(inQuietHours(berlin, at("2026-07-10T20:30:00Z"))).toBe(true);  // 22:30 local in summer
  });
  it("is off when disabled, or when start equals end", () => {
    expect(inQuietHours(q({ enabled: false }), at("2026-01-10T23:00:00Z"))).toBe(false);
    expect(inQuietHours(q({ start: "08:00", end: "08:00" }), at("2026-01-10T08:00:00Z"))).toBe(false);
    expect(inQuietHours(undefined)).toBe(false);
  });
  it("validates time zones", () => {
    expect(validTimeZone("Europe/Berlin")).toBe(true);
    expect(validTimeZone("Mars/Olympus")).toBe(false);
  });
});
