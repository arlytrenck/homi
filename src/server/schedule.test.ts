import { describe, it, expect } from "vitest";
import { activeOccurrence, describeRecurrence, lastEndedOccurrence, recentOccurrences, zonedToEpoch } from "./schedule";

const at = (iso: string) => Date.parse(iso);

describe("zonedToEpoch", () => {
  it("applies the zone's UTC offset, including DST", () => {
    expect(zonedToEpoch(2026, 1, 10, 3, 0, "Europe/Berlin")).toBe(at("2026-01-10T02:00:00Z")); // UTC+1
    expect(zonedToEpoch(2026, 7, 10, 3, 0, "Europe/Berlin")).toBe(at("2026-07-10T01:00:00Z")); // UTC+2
    expect(zonedToEpoch(2026, 7, 10, 3, 0, "America/New_York")).toBe(at("2026-07-10T07:00:00Z")); // UTC-4
    expect(zonedToEpoch(2026, 7, 10, 3, 0, "UTC")).toBe(at("2026-07-10T03:00:00Z"));
  });
});

describe("recurring occurrences", () => {
  // 2026-01-10 is a Saturday
  const sunNight = { days: [0], startTime: "03:00", durationMin: 120, tz: "UTC" };

  it("is active only inside an occurrence on the chosen day", () => {
    expect(activeOccurrence(sunNight, at("2026-01-11T03:30:00Z"))).toEqual({ start: at("2026-01-11T03:00:00Z"), end: at("2026-01-11T05:00:00Z") });
    expect(activeOccurrence(sunNight, at("2026-01-11T05:00:00Z"))).toBeNull(); // end exclusive
    expect(activeOccurrence(sunNight, at("2026-01-11T02:59:00Z"))).toBeNull();
    expect(activeOccurrence(sunNight, at("2026-01-10T03:30:00Z"))).toBeNull(); // Saturday
  });

  it("keeps a window that crosses midnight active into the next day", () => {
    const late = { days: [6], startTime: "23:00", durationMin: 180, tz: "UTC" }; // Saturday 23:00 for 3h
    expect(activeOccurrence(late, at("2026-01-10T23:30:00Z"))).not.toBeNull();
    expect(activeOccurrence(late, at("2026-01-11T01:30:00Z"))).not.toBeNull(); // Sunday, still Saturday's window
    expect(activeOccurrence(late, at("2026-01-11T02:00:00Z"))).toBeNull();
  });

  it("evaluates in the schedule's time zone", () => {
    const berlin = { days: [0], startTime: "03:00", durationMin: 60, tz: "Europe/Berlin" };
    expect(activeOccurrence(berlin, at("2026-01-11T02:30:00Z"))).not.toBeNull(); // 03:30 local
    expect(activeOccurrence(berlin, at("2026-01-11T03:30:00Z"))).toBeNull();
    expect(activeOccurrence(berlin, at("2026-07-12T01:30:00Z"))).not.toBeNull(); // summer: 03:30 local
  });

  it("finds the most recent finished occurrence", () => {
    const daily = { days: [0, 1, 2, 3, 4, 5, 6], startTime: "03:00", durationMin: 60, tz: "UTC" };
    expect(lastEndedOccurrence(daily, at("2026-01-10T12:00:00Z"))!.end).toBe(at("2026-01-10T04:00:00Z"));
    expect(lastEndedOccurrence(daily, at("2026-01-10T03:30:00Z"))!.end).toBe(at("2026-01-09T04:00:00Z")); // today's still running
    expect(recentOccurrences({ ...daily, days: [] }, at("2026-01-10T12:00:00Z"))).toEqual([]);
  });

  it("describes itself", () => {
    expect(describeRecurrence({ days: [0, 6], startTime: "03:00", durationMin: 120, tz: "UTC" })).toBe("Every Sun, Sat 03:00–05:00 (UTC)");
    expect(describeRecurrence({ days: [0, 1, 2, 3, 4, 5, 6], startTime: "23:30", durationMin: 90, tz: "UTC" })).toBe("Every day 23:30–01:00 (UTC)");
  });
});
