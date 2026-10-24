import { describe, it, expect, vi } from "vitest";

vi.mock("@/server/settings", () => ({ getSetting: (_k: string, fallback: unknown) => fallback }));

import { runCheck } from "./runner";

const base = { timeoutMs: 800 };

describe("runCheck IP-literal guard", () => {
  it.each([
    ["tcp", "169.254.169.254:80"],
    ["tcp", "127.0.0.1:22"],
    ["tcp", "[::1]:22"],
    ["tls", "169.254.169.254"],
    ["tls", "127.0.0.1:8443"],
    ["ping", "169.254.169.254"],
  ] as const)("%s check to %s is blocked", async (type, target) => {
    const r = await runCheck({ ...base, type, target });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Blocked target/);
  });
});
