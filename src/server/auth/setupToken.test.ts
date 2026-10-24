import { describe, it, expect } from "vitest";
import path from "node:path";
import { openDb, runMigrations } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { initSetupCode, setupToken, setupTokenMatches } from "./setupToken";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
const fresh = () => { const { db } = openDb(":memory:"); runMigrations(db); return db; };

describe("setup code", () => {
  it("is generated while no account exists, and required", () => {
    const code = initSetupCode(fresh(), {} as NodeJS.ProcessEnv)!;
    expect(code).toMatch(/^[0-9a-f]{12}$/);
    expect(setupToken({} as NodeJS.ProcessEnv)).toBe(code);
    expect(setupTokenMatches("nope", code)).toBe(false);
    expect(setupTokenMatches(undefined, code)).toBe(false);
    expect(setupTokenMatches(code, code)).toBe(true);
  });
  it("is not generated when HOMI_SETUP_TOKEN or HOMI_SETUP_OPEN is set, or an account exists", () => {
    expect(initSetupCode(fresh(), { HOMI_SETUP_TOKEN: "x" } as never)).toBeNull();
    expect(setupToken({ HOMI_SETUP_TOKEN: "x" } as never)).toBe("x");
    expect(initSetupCode(fresh(), { HOMI_SETUP_OPEN: "1" } as never)).toBeNull();
    expect(setupToken({} as never)).toBeNull();
    const db = fresh();
    db.insert(users).values({ id: "u", username: "a", passwordHash: "h", createdAt: 1, updatedAt: 1 }).run();
    expect(initSetupCode(db, {} as never)).toBeNull();
  });
  it("accepts anything when no token is required", () => { expect(setupTokenMatches(undefined, null)).toBe(true); });
});
