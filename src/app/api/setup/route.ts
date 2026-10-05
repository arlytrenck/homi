import { z } from "zod";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ApiError, route, isSecure, clientIp, audit } from "@/server/api";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { COOKIE, createSession, cookieOptions, newId } from "@/server/auth/session";

export const dynamic = "force-dynamic";
const Body = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(10).max(256), setupToken: z.string().optional() });

export const POST = route({ auth: "none", body: Body }, async ({ req, body }) => {
  if (process.env.HOMI_SETUP_TOKEN && body.setupToken !== process.env.HOMI_SETUP_TOKEN) throw new ApiError(403, "bad_setup_token", "Invalid setup token");
  const db = getDb();
  const passwordHash = await hashPassword(body.password);
  const userId = newId();
  const created = db.transaction((tx) => {
    if (tx.select({ n: sql<number>`count(*)` }).from(users).get()!.n > 0) return false;
    const now = Date.now();
    tx.insert(users).values({ id: userId, username: body.username, passwordHash, createdAt: now, updatedAt: now }).run();
    return true;
  });
  if (!created) throw new ApiError(409, "already_setup", "Homi is already set up");
  const s = createSession(userId, { userAgent: req.headers.get("user-agent"), ip: clientIp(req) });
  await audit(body.username, "setup");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, s.token, cookieOptions(isSecure(req), s.expiresAt));
  return res;
});
