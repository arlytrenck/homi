import "server-only";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { users } from "@/server/db/schema";

const g = globalThis as unknown as { __homiSetupCode?: string };

/**
 * Token that first-run setup must present: HOMI_SETUP_TOKEN if set, otherwise a one-time code generated
 * at boot (printed to the server log) while no account exists. HOMI_SETUP_OPEN=1 restores open setup.
 */
export function setupToken(env = process.env): string | null {
  return env.HOMI_SETUP_TOKEN || g.__homiSetupCode || null;
}

/** Call once at boot: creates the one-time code only if setup is still pending and nothing else guards it. */
export function initSetupCode(db: Db, env = process.env): string | null {
  g.__homiSetupCode = undefined;
  if (env.HOMI_SETUP_TOKEN || env.HOMI_SETUP_OPEN === "1") return null;
  if (db.select({ n: sql<number>`count(*)` }).from(users).get()!.n > 0) return null;
  return (g.__homiSetupCode = crypto.randomBytes(6).toString("hex"));
}

export function setupTokenMatches(given: string | undefined, expected: string | null): boolean {
  if (!expected) return true;
  const a = Buffer.from(given ?? ""), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
