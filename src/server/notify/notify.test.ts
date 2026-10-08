import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { classify, deliver, describe as describeEvent, notifyTransition, readDestinations, sealUrl, writeDestinations } from "./notify";
import { openDb, runMigrations } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import path from "node:path";
import crypto from "node:crypto";
import { resetMasterKeyForTests } from "@/server/crypto/secretbox";

describe("classify", () => {
  it.each([["up", "down", "down"], ["degraded", "down", "down"], ["down", "up", "recovered"], ["down", "degraded", "recovered"], ["up", "degraded", null], ["unknown", "down", null], ["unknown", "up", null], ["down", "down", null]])("%s → %s = %s", (a, b, want) => {
    expect(classify(a, b)).toBe(want);
  });
});

describe("deliver", () => {
  let srv: http.Server, url: string;
  const got: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  beforeAll(async () => {
    process.env.HOMI_ALLOW_LOOPBACK = "1";
    srv = http.createServer((req, res) => {
      let body = ""; req.on("data", (c) => (body += c));
      req.on("end", () => { got.push({ headers: req.headers, body }); res.statusCode = req.url === "/fail" ? 500 : 200; res.end(); });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(() => srv.close());
  const ev = { kind: "down" as const, name: "Plex", status: "down", previous: "up", error: "timeout", ts: 1 };

  it("webhook posts chat-compatible JSON", async () => {
    await deliver("webhook", `${url}/hook`, ev);
    const j = JSON.parse(got.at(-1)!.body);
    expect(j).toMatchObject({ text: "Plex is down: timeout", content: "Plex is down: timeout", event: "down", service: "Plex" });
  });
  it("ntfy posts plain text with title and priority", async () => {
    await deliver("ntfy", `${url}/topic`, ev);
    expect(got.at(-1)!.body).toBe("Plex is down: timeout");
    expect(got.at(-1)!.headers).toMatchObject({ title: "Plex is down", priority: "high" });
  });
  it("rejects non-2xx", async () => {
    await expect(deliver("webhook", `${url}/fail`, ev)).rejects.toThrow(/500/);
  });
  it("fans out to every enabled destination; one failing does not block the others", async () => {
    process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
    resetMasterKeyForTests(crypto.randomBytes(32));
    const db = openDb(":memory:").db; runMigrations(db);
    writeDestinations(db, [
      { id: "a", kind: "webhook", urlSealed: sealUrl(`${url}/fail`), enabled: true, onRecovery: true },
      { id: "b", kind: "ntfy", urlSealed: sealUrl(`${url}/topic`), enabled: true, onRecovery: true },
      { id: "c", kind: "webhook", urlSealed: sealUrl(`${url}/off`), enabled: false, onRecovery: true },
    ]);
    const before = got.length;
    await notifyTransition(db, ev);
    expect(got.length - before).toBe(2);
  });
  it("describes recovery with downtime", () => {
    expect(describeEvent({ ...ev, kind: "recovered", status: "up", downForMs: 7 * 60_000 }).text).toBe("Plex is back up after 7 min");
  });
});

describe("destinations storage", () => {
  process.env.HOMI_MIGRATIONS = path.resolve("drizzle");
  it("upgrades the legacy single-destination setting", () => {
    const db = openDb(":memory:").db; runMigrations(db);
    db.insert(settings).values({ key: "notifications", value: { enabled: true, kind: "ntfy", urlSealed: "x", onRecovery: false } as any }).run();
    expect(readDestinations(db)).toEqual([{ id: "d1", kind: "ntfy", urlSealed: "x", enabled: true, onRecovery: false }]);
  });
  it("round-trips several destinations", () => {
    const db = openDb(":memory:").db; runMigrations(db);
    const d = [{ id: "a", kind: "webhook" as const, urlSealed: "1", enabled: true, onRecovery: true }, { id: "b", kind: "ntfy" as const, urlSealed: "2", enabled: false, onRecovery: true }];
    writeDestinations(db, d);
    expect(readDestinations(db)).toEqual(d);
  });
});
