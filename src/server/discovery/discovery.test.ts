import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDb, runMigrations, type Db } from "@/server/db/client";
import { checks, groups, services } from "@/server/db/schema";
import { parseContainer, type DockerContainer } from "./labels";
import { syncDiscovered, MISSING_TTL_MS } from "./sync";

process.env.HOMI_MIGRATIONS = path.resolve("drizzle");

const c = (name: string, labels: Record<string, string>, ports: DockerContainer["Ports"] = []): DockerContainer => ({ Id: "id-" + name, Names: ["/" + name], Labels: labels, Ports: ports });

describe("parseContainer", () => {
  it("ignores containers without homi.enable", () => {
    expect(parseContainer(c("a", {}), {})).toBeNull();
    expect(parseContainer(c("a", { "homi.enable": "false" }), {})).toBeNull();
  });
  it("parses a full label set", () => {
    const r = parseContainer(c("plex", { "homi.enable": "true", "homi.name": "Plex", "homi.group": "Media", "homi.url": "https://plex.lan", "homi.icon": "🎬", "homi.description": "Media", "homi.public": "false" }), {});
    expect(r).toMatchObject({ ok: true, value: { key: "plex", name: "Plex", group: "Media", url: "https://plex.lan", hiddenPublic: true, check: { type: "http", target: "https://plex.lan" } } });
  });
  it("defaults name to container name and public visibility to inherit", () => {
    const r = parseContainer(c("web", { "homi.enable": "true", "homi.url": "http://x" }), {});
    expect(r).toMatchObject({ ok: true, value: { name: "web", hiddenPublic: false } });
  });
  it("derives URL from published port only with a host", () => {
    const ports = [{ PrivatePort: 80, PublicPort: 8080, Type: "tcp" }];
    expect(parseContainer(c("w", { "homi.enable": "true" }, ports), { host: "nas.lan" })).toMatchObject({ ok: true, value: { url: "http://nas.lan:8080" } });
    expect(parseContainer(c("w", { "homi.enable": "true" }, ports), {})).toMatchObject({ ok: false });
    expect(parseContainer(c("w", { "homi.enable": "true" }, []), { host: "h" })).toMatchObject({ ok: false });
  });
  it("supports check kinds and rejects bad input", () => {
    const base = { "homi.enable": "true", "homi.url": "http://svc.lan:9000" };
    expect(parseContainer(c("a", { ...base, "homi.check": "none" }), {})).toMatchObject({ ok: true, value: { check: null } });
    expect(parseContainer(c("a", { ...base, "homi.check": "tcp", "homi.check.target": "svc.lan:9000" }), {})).toMatchObject({ ok: true, value: { check: { type: "tcp", target: "svc.lan:9000" } } });
    expect(parseContainer(c("a", { ...base, "homi.check": "ping" }), {})).toMatchObject({ ok: true, value: { check: { type: "ping", target: "svc.lan" } } });
    expect(parseContainer(c("a", { ...base, "homi.check": "tcp" }), {})).toMatchObject({ ok: false });
    expect(parseContainer(c("a", { ...base, "homi.check": "smtp" }), {})).toMatchObject({ ok: false });
    expect(parseContainer(c("a", { "homi.enable": "true", "homi.url": "javascript:alert(1)" }), {})).toMatchObject({ ok: false });
    expect(parseContainer(c("a", { "homi.enable": "true", "homi.url": "ftp://x" }), {})).toMatchObject({ ok: false });
  });
});

describe("syncDiscovered", () => {
  let db: Db;
  beforeEach(() => { db = openDb(":memory:").db; runMigrations(db); });
  const plex = (extra: Record<string, string> = {}) => c("plex", { "homi.enable": "true", "homi.name": "Plex", "homi.group": "Media", "homi.url": "http://plex.lan", ...extra });
  const t0 = 1_000_000;

  it("creates group, service and check", () => {
    expect(syncDiscovered([plex()], {}, db, t0)).toMatchObject({ created: 1, updated: 0 });
    const s = db.select().from(services).get()!;
    expect(s).toMatchObject({ name: "Plex", source: "docker", sourceRef: "plex" });
    expect(db.select().from(groups).get()!.name).toBe("Media");
    expect(db.select().from(checks).get()).toMatchObject({ serviceId: s.id, type: "http", target: "http://plex.lan" });
  });
  it("is idempotent and updates label-owned fields but not user placement", () => {
    syncDiscovered([plex()], {}, db, t0);
    const s = db.select().from(services).get()!;
    db.update(services).set({ sort: 42, groupId: null }).where(eq(services.id, s.id)).run(); // user moved it
    const r = syncDiscovered([plex({ "homi.name": "Plex 2", "homi.url": "http://plex.lan:32400" })], {}, db, t0 + 1);
    expect(r).toMatchObject({ created: 0, updated: 1 });
    const after = db.select().from(services).get()!;
    expect(after).toMatchObject({ id: s.id, name: "Plex 2", url: "http://plex.lan:32400", sort: 42, groupId: null });
    expect(db.select().from(checks).all()).toHaveLength(1);
    expect(db.select().from(groups).all()).toHaveLength(1);
  });
  it("reports no update when labels are unchanged", () => {
    syncDiscovered([plex()], {}, db, t0);
    expect(syncDiscovered([plex()], {}, db, t0 + 1)).toMatchObject({ created: 0, updated: 0 });
  });
  it("survives container recreation (same name, new id)", () => {
    syncDiscovered([plex()], {}, db, t0);
    syncDiscovered([{ ...plex(), Id: "new-id" }], {}, db, t0 + 1);
    expect(db.select().from(services).all()).toHaveLength(1);
  });
  it("marks missing, keeps for 24h, then removes", () => {
    syncDiscovered([plex()], {}, db, t0);
    expect(syncDiscovered([], {}, db, t0 + 1000)).toMatchObject({ missing: 1, removed: 0 });
    let s = db.select().from(services).get()!;
    expect(s.missingSince).toBe(t0 + 1000);
    expect(db.select().from(checks).get()).toMatchObject({ enabled: false, lastStatus: "unknown" });
    expect(syncDiscovered([], {}, db, t0 + 2000).missing).toBe(1);
    expect(db.select().from(services).get()!.missingSince).toBe(t0 + 1000); // not reset
    expect(syncDiscovered([], {}, db, t0 + 1000 + MISSING_TTL_MS)).toMatchObject({ removed: 1 });
    expect(db.select().from(services).all()).toHaveLength(0);
    expect(db.select().from(checks).all()).toHaveLength(0);
    s = undefined as never; void s;
  });
  it("restores a missing service when the container returns", () => {
    syncDiscovered([plex()], {}, db, t0);
    syncDiscovered([], {}, db, t0 + 1000);
    syncDiscovered([plex()], {}, db, t0 + 2000);
    expect(db.select().from(services).get()!.missingSince).toBeNull();
    expect(db.select().from(checks).get()!.enabled).toBe(true);
  });
  it("keeps an existing service when labels become invalid (no flapping)", () => {
    syncDiscovered([plex()], {}, db, t0);
    const r = syncDiscovered([plex({ "homi.check": "bogus" })], {}, db, t0 + 1);
    expect(r.skipped).toHaveLength(1);
    expect(r.removed + r.missing).toBe(0);
    expect(db.select().from(services).get()!.missingSince).toBeNull();
  });
  it("never touches manual services", () => {
    db.insert(services).values({ id: "m1", name: "Manual", url: "http://m", createdAt: 1, updatedAt: 1 }).run();
    syncDiscovered([], {}, db, t0);
    expect(db.select().from(services).all()).toHaveLength(1);
  });
  it("removes the check when homi.check=none", () => {
    syncDiscovered([plex()], {}, db, t0);
    syncDiscovered([plex({ "homi.check": "none" })], {}, db, t0 + 1);
    expect(db.select().from(checks).all()).toHaveLength(0);
  });
});
