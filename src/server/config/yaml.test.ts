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

describe("yaml backup of maintenance schedules and alert destinations", () => {
  let mod: typeof import("./yaml");
  let notify: typeof import("@/server/notify/notify");
  let db: import("@/server/db/client").Db;
  beforeEach(async () => {
    mod = await import("./yaml"); notify = await import("@/server/notify/notify");
    const { getDb } = await import("@/server/db/client");
    const { resetMasterKeyForTests } = await import("@/server/crypto/secretbox");
    resetMasterKeyForTests((await import("node:crypto")).randomBytes(32));
    db = getDb();
    const s = await import("@/server/db/schema");
    db.delete(s.maintenanceSchedules).run(); db.delete(s.services).run(); db.delete(s.groups).run();
    notify.writeDestinations(db, []);
  });

  const DOC = `version: 1
groups:
  - name: Media
    services:
      - { name: Plex, url: "http://10.0.0.5:32400" }
alerts:
  destinations:
    - kind: ntfy
      groups: [Media]
      tags: [critical]
      onRecovery: false
      quiet: { enabled: true, start: "22:00", end: "07:00", tz: UTC, digest: true, overrideTags: [critical] }
    - { kind: webhook, ungrouped: true }
maintenance:
  schedules:
    - { name: Sunday patching, scope: group, target: Media, days: [0], startTime: "03:00", durationMin: 120, tz: UTC }
    - { scope: service, target: Plex, days: [1, 2], startTime: "04:00", durationMin: 30, tz: UTC, enabled: false }
`;

  it("imports both, resolving names; destinations arrive switched off", () => {
    const r = mod.importYaml(DOC, { mode: "merge", dryRun: false });
    expect(r).toMatchObject({ schedulesCreated: 2, destinationsAdded: 2, skipped: [] });
    const dests = notify.readDestinations(db);
    expect(dests).toHaveLength(2);
    expect(dests.every((d) => d.enabled === false && d.urlSealed === null)).toBe(true);
    expect(dests[0]).toMatchObject({ kind: "ntfy", tags: ["critical"], onRecovery: false });
    expect(dests[0].groupIds).toHaveLength(1);
    expect(dests[1].groupIds).toEqual(["__none__"]);
  });

  it("export never contains a destination URL, and re-importing the export changes nothing", async () => {
    mod.importYaml(DOC, { mode: "merge", dryRun: false });
    const d = notify.readDestinations(db);
    notify.writeDestinations(db, [{ ...d[0], urlSealed: notify.sealUrl("https://ntfy.example/secret-topic"), enabled: true }, d[1]]);
    const out = mod.exportYaml();
    expect(out).not.toContain("secret-topic");
    expect(out.slice(out.indexOf("alerts:"), out.indexOf("maintenance:"))).not.toContain("url");
    expect(out).toContain("Sunday patching");
    const again = mod.importYaml(out, { mode: "merge", dryRun: false });
    expect(again).toMatchObject({ schedulesCreated: 0, schedulesUpdated: 2, destinationsAdded: 0 });
    expect(notify.readDestinations(db)).toHaveLength(2);
    expect(mod.exportYaml()).toBe(out);
  });

  it("skips items whose group or service is not in the file or database, and says so", () => {
    const r = mod.importYaml(`version: 1
alerts:
  destinations:
    - { kind: webhook, groups: [Nope] }
maintenance:
  schedules:
    - { scope: group, target: Nope, days: [0], startTime: "03:00", durationMin: 60, tz: UTC }
    - { scope: all, days: [0], startTime: "03:00", durationMin: 60, tz: "Mars/Olympus" }
`, { mode: "merge", dryRun: false });
    expect(r).toMatchObject({ schedulesCreated: 0, destinationsAdded: 0 });
    expect(r.skipped).toHaveLength(3);
    expect(notify.readDestinations(db)).toEqual([]);
  });

  it("caps destinations at five", () => {
    const many = Array.from({ length: 5 }, (_, i) => `    - { kind: webhook, tags: [t${i}] }`).join("\n");
    mod.importYaml(`version: 1\nalerts:\n  destinations:\n${many}\n`, { mode: "merge", dryRun: false });
    const r = mod.importYaml(`version: 1\nalerts:\n  destinations:\n    - { kind: ntfy }\n`, { mode: "merge", dryRun: false });
    expect(r.skipped[0]).toMatch(/limit of 5/);
  });

  it("replace mode leaves sections the file lacks alone, re-pointing them at the recreated groups", () => {
    mod.importYaml(DOC, { mode: "merge", dryRun: false });
    const before = notify.readDestinations(db)[0];
    mod.importYaml(`version: 1\ngroups:\n  - name: Media\n    services:\n      - { name: Plex, url: "http://10.0.0.5:32400" }\n`, { mode: "replace", dryRun: false });
    const after = notify.readDestinations(db);
    expect(after).toHaveLength(2);
    expect(after[0].groupIds).toHaveLength(1);
    expect(after[0].groupIds![0]).not.toBe(before.groupIds![0]); // new group id, same group
    return import("@/server/db/schema").then((s) => {
      const sc = db.select().from(s.maintenanceSchedules).all();
      expect(sc).toHaveLength(2);
      const media = db.select().from(s.groups).get()!;
      expect(sc.find((x) => x.kind === "group")!.targetId).toBe(media.id);
      expect(sc.every((x) => x.enabled === (x.kind === "group"))).toBe(true); // unchanged: service one was already off
    });
  });

  it("replace mode with an empty section clears it", () => {
    mod.importYaml(DOC, { mode: "merge", dryRun: false });
    mod.importYaml("version: 1\nalerts:\n  destinations: []\nmaintenance:\n  schedules: []\n", { mode: "replace", dryRun: false });
    expect(notify.readDestinations(db)).toEqual([]);
    return import("@/server/db/schema").then((s) => expect(db.select().from(s.maintenanceSchedules).all()).toEqual([]));
  });
});
