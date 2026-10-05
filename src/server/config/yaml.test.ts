import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
process.env.HOMI_DATA = ":memory:";

vi.mock("@/server/db/client", async (orig) => {
  const real = await orig<typeof import("@/server/db/client")>();
  const { db } = real.openDb(":memory:"); real.runMigrations(db);
  return { ...real, getDb: () => db };
});
vi.mock("@/server/scheduler/scheduler", () => ({ getScheduler: () => undefined }));

const YAML_IN = `version: 1
groups:
  - name: Media
    services:
      - { name: Plex, url: "http://10.0.0.5:32400", check: { type: tcp, target: "10.0.0.5:32400" } }
ungrouped:
  - { name: Router, url: "http://10.0.0.1" }
`;

describe("yaml import/export", () => {
  let mod: typeof import("./yaml");
  beforeEach(async () => { mod = await import("./yaml"); });

  it("dry run reports counts but writes nothing", () => {
    const r = mod.importYaml(YAML_IN, { mode: "merge", dryRun: true });
    expect(r).toMatchObject({ groupsCreated: 1, servicesCreated: 2, dryRun: true });
    expect(mod.exportYaml()).not.toContain("Plex");
  });
  it("import then export round-trips; re-import is idempotent", () => {
    mod.importYaml(YAML_IN, { mode: "merge", dryRun: false });
    const out = mod.exportYaml();
    expect(out).toContain("Plex");
    const again = mod.importYaml(out, { mode: "merge", dryRun: false });
    expect(again).toMatchObject({ groupsCreated: 0, servicesCreated: 0, servicesUpdated: 2 });
    expect(mod.exportYaml()).toBe(out);
  });
  it("rejects invalid documents", () => {
    expect(() => mod.importYaml("version: 2", { mode: "merge", dryRun: true })).toThrow();
  });
});
