import "server-only";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { COOKIE, lookupSession } from "./session";
import { getSetting } from "@/server/api";

export const needsSetup = () => getDb().select({ n: sql<number>`count(*)` }).from(users).get()!.n === 0;

export async function pageViewer(): Promise<"admin" | "public" | "anon"> {
  const s = lookupSession((await cookies()).get(COOKIE)?.value);
  if (s) return "admin";
  return getSetting("publicView", false) ? "public" : "anon";
}
