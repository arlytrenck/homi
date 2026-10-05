import "server-only";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const dataDir = () => process.env.HOMI_DATA ?? path.resolve("data");

export function openDb(file: string): { db: Db; raw: Database.Database } {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new Database(file);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("busy_timeout = 5000");
  return { db: drizzle(raw, { schema }), raw };
}

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: process.env.HOMI_MIGRATIONS ?? path.resolve("drizzle") });
}

// Process-wide singleton (survives Next dev module reloads).
const g = globalThis as unknown as { __homiDb?: { db: Db; raw: Database.Database } };

export function getDb(): Db {
  if (!g.__homiDb) {
    g.__homiDb = openDb(path.join(dataDir(), "homi.db"));
    runMigrations(g.__homiDb.db);
  }
  return g.__homiDb.db;
}

export function closeDb() {
  g.__homiDb?.raw.close();
  g.__homiDb = undefined;
}
