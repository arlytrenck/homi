import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { classify, deliver, describe as describeEvent } from "./notify";

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
  it("describes recovery with downtime", () => {
    expect(describeEvent({ ...ev, kind: "recovered", status: "up", downForMs: 7 * 60_000 }).text).toBe("Plex is back up after 7 min");
  });
});
