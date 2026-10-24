import { describe, it, expect, beforeEach } from "vitest";
import { checkLimit, loginKeys, recordFailure, recordSuccess, resetLimits } from "./ratelimit";

beforeEach(resetLimits);
describe("ratelimit", () => {
  it("locks after 5 failures and clears on success", () => {
    for (let i = 0; i < 4; i++) recordFailure("k", 1000);
    expect(checkLimit("k", 1000)).toBe(0);
    recordFailure("k", 1000);
    expect(checkLimit("k", 1000)).toBeGreaterThan(0);
    recordSuccess("k");
    expect(checkLimit("k", 1000)).toBe(0);
  });
  it("lockout expires", () => {
    for (let i = 0; i < 5; i++) recordFailure("k", 0);
    expect(checkLimit("k", 31_000)).toBe(0);
  });
  it("one client failing does not lock others out when the IP is known", () => {
    for (let i = 0; i < 5; i++) loginKeys("1.1.1.1", "Admin").forEach((k) => recordFailure(k, 0));
    expect(Math.max(...loginKeys("1.1.1.1", "admin").map((k) => checkLimit(k, 1)))).toBeGreaterThan(0);
    expect(Math.max(...loginKeys("2.2.2.2", "admin").map((k) => checkLimit(k, 1)))).toBe(0);
  });
  it("without a trusted IP, failures for one username do not lock another", () => {
    for (let i = 0; i < 5; i++) loginKeys(null, "mallory").forEach((k) => recordFailure(k, 0));
    expect(Math.max(...loginKeys(null, "admin").map((k) => checkLimit(k, 1)))).toBe(0);
  });
});
