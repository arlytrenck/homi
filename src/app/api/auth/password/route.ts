import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, route, audit } from "@/server/api";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeOthers } from "@/server/auth/session";

export const dynamic = "force-dynamic";
const Body = z.object({ currentPassword: z.string(), newPassword: z.string().min(10).max(256) });

export const POST = route({ auth: "admin", body: Body }, async ({ viewer, body }) => {
  if (viewer.kind !== "admin") return;
  const u = getDb().select().from(users).where(eq(users.id, viewer.user.id)).get()!;
  if (!(await verifyPassword(u.passwordHash, body.currentPassword))) throw new ApiError(403, "invalid_credentials", "Current password is incorrect");
  getDb().update(users).set({ passwordHash: await hashPassword(body.newPassword), updatedAt: Date.now() }).where(eq(users.id, u.id)).run();
  revokeOthers(u.id, viewer.sessionId);
  await audit(u.username, "password_changed");
});
