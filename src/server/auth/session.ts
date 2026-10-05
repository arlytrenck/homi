import "server-only";
import crypto from "node:crypto";
import { eq, and, ne } from "drizzle-orm";
import { ulid } from "ulid";
import { getDb, type Db } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";

export const COOKIE = "homi_session";
const TTL = 30 * 24 * 3600_000;
const TOUCH = 5 * 60_000;

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null }, db: Db = getDb()) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.insert(sessions).values({ id: sha(token), userId, createdAt: now, lastSeenAt: now, expiresAt: now + TTL, userAgent: meta.userAgent ?? null, ip: meta.ip ?? null }).run();
  return { token, expiresAt: now + TTL };
}

export function lookupSession(token: string | undefined, db: Db = getDb()) {
  if (!token) return null;
  const id = sha(token);
  const row = db.select({ s: sessions, u: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.id, id)).get();
  if (!row) return null;
  const now = Date.now();
  if (row.s.expiresAt < now) { db.delete(sessions).where(eq(sessions.id, id)).run(); return null; }
  if (now - row.s.lastSeenAt > TOUCH) db.update(sessions).set({ lastSeenAt: now, expiresAt: now + TTL }).where(eq(sessions.id, id)).run();
  return { sessionId: id, user: { id: row.u.id, username: row.u.username } };
}

export const destroySession = (token: string, db: Db = getDb()) => { db.delete(sessions).where(eq(sessions.id, sha(token))).run(); };
export const revokeOthers = (userId: string, keepId: string, db: Db = getDb()) => { db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, keepId))).run(); };
export const newId = () => ulid();

export function cookieOptions(secure: boolean, expiresAt: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", expires: new Date(expiresAt) };
}
