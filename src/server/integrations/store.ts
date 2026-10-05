import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { integrations } from "@/server/db/schema";
import { newId } from "@/server/auth/session";
import { openSecrets, sealSecrets } from "./runtime";
import type { IntegrationInput } from "@/lib/schemas";

type Row = typeof integrations.$inferSelect;

export const toDto = (r: Row) => {
  let setKeys: string[] = [];
  try { setKeys = Object.keys(openSecrets(r)); } catch { setKeys = []; }
  return {
    id: r.id, type: r.type, name: r.name, baseUrl: r.baseUrl, config: r.config, ignoreTls: r.ignoreTls, enabled: r.enabled,
    lastOkAt: r.lastOkAt, lastError: r.lastError,
    secrets: Object.fromEntries(setKeys.map((k) => [k, { set: true }])),
  };
};

/** Merge secret updates: undefined keeps, null/"" clears, string sets. */
export function mergeSecrets(existing: Record<string, string>, patch: Record<string, string | null>): Record<string, string> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") delete out[k]; else out[k] = v; }
  return out;
}

export function createIntegration(i: IntegrationInput) {
  const id = newId(), now = Date.now();
  const secrets = mergeSecrets({}, i.secrets);
  getDb().insert(integrations).values({ id, type: i.type, name: i.name, baseUrl: i.baseUrl, config: i.config, secrets: sealSecrets(id, i.type, secrets), ignoreTls: i.ignoreTls, enabled: i.enabled, createdAt: now, updatedAt: now }).run();
  return id;
}

export function updateIntegration(id: string, patch: Partial<IntegrationInput>): boolean {
  const db = getDb();
  const row = db.select().from(integrations).where(eq(integrations.id, id)).get();
  if (!row) return false;
  let sealed = row.secrets;
  if (patch.secrets) {
    let existing: Record<string, string> = {};
    try { existing = openSecrets(row); } catch { /* unreadable: replace */ }
    sealed = sealSecrets(id, row.type, mergeSecrets(existing, patch.secrets));
  }
  db.update(integrations).set({
    ...(patch.name !== undefined && { name: patch.name }), ...(patch.baseUrl !== undefined && { baseUrl: patch.baseUrl }),
    ...(patch.config !== undefined && { config: patch.config }), ...(patch.ignoreTls !== undefined && { ignoreTls: patch.ignoreTls }),
    ...(patch.enabled !== undefined && { enabled: patch.enabled }), secrets: sealed, updatedAt: Date.now(),
  }).where(eq(integrations.id, id)).run();
  return true;
}
