import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { blockedReason } from "./policy";
import { safeFetch } from "./safeFetch";

const strict = { allowLoopback: false };
const loop = { allowLoopback: true };

describe("blockedReason", () => {
  it.each(["169.254.169.254", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "0.0.0.0", "fe80::1", "127.0.0.1", "::1", "224.0.0.1"])("blocks %s", (ip) => {
    expect(blockedReason(ip, strict)).toBeTruthy();
  });
  it.each(["10.0.0.5", "192.168.1.1", "172.16.0.9", "8.8.8.8", "fd00::1", "::ffff:c0a8:101"])("allows %s", (ip) => {
    expect(blockedReason(ip, strict)).toBeNull();
  });
  it("allows loopback only when enabled, never metadata", () => {
    expect(blockedReason("127.0.0.1", loop)).toBeNull();
    expect(blockedReason("169.254.169.254", loop)).toBeTruthy();
  });
});

describe("safeFetch", () => {
  let srv: http.Server, port: number;
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.url === "/redir") { res.writeHead(302, { location: "http://169.254.169.254/latest" }); return res.end(); }
      if (req.url === "/big") return res.end("x".repeat(2000));
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    port = (srv.address() as AddressInfo).port;
  });
  afterAll(() => srv.close());

  it("blocks loopback by default", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/`, { policy: strict })).rejects.toThrow(/Blocked/);
  });
  it("fetches when loopback allowed", async () => {
    const r = await safeFetch(`http://127.0.0.1:${port}/`, { policy: loop });
    expect(r.json()).toEqual({ ok: true });
  });
  it("blocks redirect to metadata address", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/redir`, { policy: loop })).rejects.toThrow(/Blocked/);
  });
  it("blocks non-http schemes and URL credentials", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow();
    await expect(safeFetch("http://a:b@10.0.0.1/")).rejects.toThrow(/Credentials/);
  });
  it("caps response size", async () => {
    await expect(safeFetch(`http://127.0.0.1:${port}/big`, { policy: loop, maxBytes: 100 })).rejects.toThrow();
  });
  it("blocks localhost hostname via DNS-time check", async () => {
    await expect(safeFetch(`http://localhost:${port}/`, { policy: strict })).rejects.toThrow(/Blocked/);
  });
});
