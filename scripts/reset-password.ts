import readline from "node:readline/promises";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users, sessions } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

const username = process.argv[2];
if (!username) { console.error("usage: reset-password <username>"); process.exit(1); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pw = await rl.question("New password (min 10 chars): ");
rl.close();
if (pw.length < 10) { console.error("Password too short"); process.exit(1); }
const db = getDb();
const u = db.select().from(users).where(eq(users.username, username)).get();
if (!u) { console.error("No such user"); process.exit(1); }
db.update(users).set({ passwordHash: await hashPassword(pw), updatedAt: Date.now() }).where(eq(users.id, u.id)).run();
db.delete(sessions).where(eq(sessions.userId, u.id)).run();
console.log("Password reset; all sessions revoked.");
