/**
 * Runs each configured integration against a REAL instance and prints a redacted report.
 * Reads integrations.local.json (git-ignored). Never prints secret values.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

process.env.HOMI_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "homi-verify-"));
process.env.HOMI_ALLOW_LOOPBACK = "1";
process.env.HOMI_MIGRATIONS = path.resolve("drizzle");

interface Entry { type: string; baseUrl: string; ignoreTls?: boolean; config?: Record<string, any>; secrets?: Record<string, string>; widgetOptions?: Record<string, Record<string, any>> }
const file = path.resolve("integrations.local.json");
const entries: Entry[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).integrations ?? [] : [];

let rt: typeof import("@/server/integrations/runtime");
let reg: typeof import("@/plugins/registry");
beforeAll(async () => {
  (await import("@/server/crypto/secretbox")).resetMasterKeyForTests(crypto.randomBytes(32));
  rt = await import("@/server/integrations/runtime");
  reg = await import("@/plugins/registry");
});

const redact = (text: string, e: Entry) => {
  let t = text;
  for (const v of Object.values(e.secrets ?? {})) if (v && v.length > 3) t = t.split(v).join("«secret»");
  return t;
};

describe.skipIf(!entries.length)("live integrations", () => {
  for (const e of entries) {
    it(`${e.type} @ ${e.baseUrl}`, async () => {
      const plugin = reg.getPlugin(e.type);
      expect(plugin, `unknown type ${e.type}`).toBeTruthy();
      const base = { baseUrl: e.baseUrl, config: e.config ?? {}, secrets: e.secrets ?? {}, ignoreTls: !!e.ignoreTls };
      const lines: string[] = [];

      const t0 = Date.now();
      const test = await rt.testIntegration(e.type, base);
      lines.push(`TEST   ${test.ok ? `OK  version=${test.ok ? test.version ?? "?" : ""}` : `FAIL  ${(test as any).error}`}  (${Date.now() - t0} ms)`);

      let widgetFailures = 0;
      for (const w of plugin!.widgets) {
        const ctx = rt.buildContext(`verify:${e.type}:${w.id}`, base);
        const t1 = Date.now();
        try {
          const out = await w.fetch(ctx, e.widgetOptions?.[w.id] ?? {});
          lines.push(`WIDGET ${w.id}  OK  (${Date.now() - t1} ms)\n${redact(JSON.stringify(out, null, 2), e).replace(/^/gm, "         ")}`);
          const empty = !out.stats?.length && !out.meters?.length && !out.rows?.length && !out.note;
          if (empty) { widgetFailures++; lines.push("         ^ EMPTY OUTPUT: probably an API shape mismatch"); }
          const odd = JSON.stringify(out).match(/NaN|undefined|\[object|null%|– \/ –/g);
          if (odd) { widgetFailures++; lines.push(`         ^ SUSPICIOUS VALUES: ${[...new Set(odd)].join(", ")}`); }
        } catch (err) {
          widgetFailures++;
          lines.push(`WIDGET ${w.id}  FAIL  ${redact(rt.friendlyError(err), e)}  (${Date.now() - t1} ms)`);
        }
      }
      console.log(`\n=== ${e.type} ===\n${lines.join("\n")}\n`);
      expect(test.ok, "connection test").toBe(true);
      expect(widgetFailures, "widget problems (see report above)").toBe(0);
    });
  }
});
