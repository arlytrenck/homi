import { describe, it, expect } from "vitest";
import { score } from "./palette";

describe("score", () => {
  it("ranks exact > prefix > word start > substring > scattered > none", () => {
    const s = (q: string, t: string) => score(q, t);
    expect(s("plex", "Plex")).toBeGreaterThan(s("ple", "Plex"));
    expect(s("ple", "Plex")).toBeGreaterThan(s("tau", "Home Tautulli"));
    expect(s("tau", "Home Tautulli")).toBeGreaterThan(s("aut", "Home Tautulli"));
    expect(s("aut", "Home Tautulli")).toBeGreaterThan(s("htl", "Home Tautulli"));
    expect(s("zzz", "Plex")).toBe(0);
  });
  it("matches everything for an empty query", () => { expect(score("  ", "anything")).toBeGreaterThan(0); });
  it("is case-insensitive and treats separators as word starts", () => {
    expect(score("PLEX", "plex")).toBe(100);
    expect(score("ui", "pi-hole ui")).toBe(80);
  });
});
