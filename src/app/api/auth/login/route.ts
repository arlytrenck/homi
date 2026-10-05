import { z } from "zod";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ApiError, route, isSecure, clientIp, audit } from "@/server/api";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { COOKIE, createSession, cookieOptions } from "@/server/auth/session";
import { checkLimit, recordFailure, recordSuccess } from "@/server/auth/ratelimit";

export const dynamic = "force-dynamic";
const Body = z.object({ username: z.string().max(64), password: z.string().max(256) });

export const POST = route({ auth: "none", body: Body }, async ({ req, body }) => {
  const ip = clientIp(req);
  const keys = [`ip:${ip}`, `user:${body.username.toLowerCase()}`];
  const wait = Math.max(...keys.map((k) => checkLimit(k)));
  if (wait > 0) {
    const r = NextResponse.json({ error: { code: "rate_limited", message: "Too many attempts. Try again later." } }, { status: 429 });
    r.headers.set("Retry-After", String(Math.ceil(wait / 1000)));
    return r;
  }
  const u = getDb().select().from(users).where(eq(users.username, body.username)).get();
  const ok = u ? await verifyPassword(u.passwordHash, body.password) : (await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", body.password), false);
  if (!u || !ok) {
    keys.forEach((k) => recordFailure(k));
    await audit(body.username, "login_failed", { ip });
    throw new ApiError(401, "invalid_credentials", "Invalid username or password");
  }
  keys.forEach(recordSuccess);
  const s = createSession(u.id, { userAgent: req.headers.get("user-agent"), ip });
  await audit(u.username, "login", { ip });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, s.token, cookieOptions(isSecure(req), s.expiresAt));
  return res;
});
