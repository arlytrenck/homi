import { describe, it, expect, beforeEach } from "vitest";
import { checkLimit, recordFailure, recordSuccess, resetLimits } from "./ratelimit";

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
});
