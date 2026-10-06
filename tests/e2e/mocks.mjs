// Mock services for e2e: a Sonarr-like API on :4999 and a fake Docker socket.
import http from "node:http";
import fs from "node:fs";

const SOCK = "/tmp/homi-e2e-docker.sock";
export const API_KEY = "e2e-sonarr-key";

http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const send = (c, o) => { res.writeHead(c, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u === "/health") return send(200, { ok: true });
  if (req.headers["x-api-key"] !== API_KEY) return send(401, {});
  if (u === "/api/v3/system/status") return send(200, { version: "4.0.9" });
  if (u === "/api/v3/queue") return send(200, { totalRecords: 4 });
  if (u === "/api/v3/wanted/missing") return send(200, { totalRecords: 9 });
  if (u === "/api/v3/health") return send(200, []);
  if (u === "/api/v3/calendar") return send(200, []);
  send(404, {});
}).listen(4999, "127.0.0.1");

// Containers the fake Docker daemon reports. Only GET /containers/json is allowed, like a socket proxy.
try { fs.unlinkSync(SOCK); } catch {}
const containers = [
  { Id: "p1", Names: ["/plex"], Labels: { "homi.enable": "true", "homi.name": "Plex", "homi.group": "Media", "homi.url": "http://127.0.0.1:4999/health", "homi.description": "Media server" }, Ports: [] },
  { Id: "d1", Names: ["/db"], Labels: {}, Ports: [] },
  { Id: "b1", Names: ["/broken"], Labels: { "homi.enable": "true", "homi.check": "smtp", "homi.url": "http://x" }, Ports: [] },
];
// The daemon reports no containers until the discovery spec creates this flag file.
export const FLAG = "/tmp/homi-e2e-docker-on";
try { fs.unlinkSync(FLAG); } catch {}
http.createServer((req, res) => {
  if (req.method !== "GET" || !req.url.startsWith("/containers/json")) { res.writeHead(403); return res.end("{}"); }
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(fs.existsSync(FLAG) ? containers : []));
}).listen(SOCK);
