import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { settings } from "@/server/db/schema";

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  return row ? (row.value as T) : fallback;
}
