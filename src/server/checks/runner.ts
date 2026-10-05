import "server-only";
import net from "node:net";
import { execFile } from "node:child_process";
import { safeFetch } from "@/server/net/safeFetch";

export interface CheckSpec {
  type: "http" | "tcp" | "ping";
  target: string;
  timeoutMs: number;
  httpMethod?: string;
  expectedStatus?: string;
  keyword?: string | null;
  ignoreTls?: boolean;
}
export interface CheckOutcome { ok: boolean; latencyMs: number | null; code?: number; error?: string; degraded?: boolean }

export function statusMatches(code: number, expected: string): boolean {
  const [a, b] = expected.split("-").map(Number);
  return b === undefined ? code === a : code >= a && code <= b;
}

const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$|^[0-9a-fA-F:]+$/;

export function parseHostPort(target: string, defaultPort?: number): { host: string; port: number } {
  const m = target.match(/^\[([^\]]+)\]:(\d+)$/) ?? target.match(/^([^:]+):(\d+)$/);
  if (m) return { host: m[1], port: Number(m[2]) };
  if (defaultPort) return { host: target, port: defaultPort };
  throw new Error("Target must be host:port");
}

async function tcp(spec: CheckSpec): Promise<CheckOutcome> {
  const { host, port } = parseHostPort(spec.target);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: spec.timeoutMs });
    s.once("connect", () => { s.destroy(); resolve({ ok: true, latencyMs: Date.now() - t0 }); });
    s.once("timeout", () => { s.destroy(); resolve({ ok: false, latencyMs: null, error: "timeout" }); });
    s.once("error", (e) => resolve({ ok: false, latencyMs: null, error: e.message }));
  });
}

async function ping(spec: CheckSpec): Promise<CheckOutcome> {
  const host = spec.target.trim();
  if (!HOST_RE.test(host)) return { ok: false, latencyMs: null, error: "invalid host" };
  const t0 = Date.now();
  return new Promise((resolve) => {
    execFile("ping", ["-c", "1", "-W", String(Math.max(1, Math.ceil(spec.timeoutMs / 1000))), host], { timeout: spec.timeoutMs + 1000 }, (err, stdout) => {
      if (!err) {
        const m = stdout.match(/time[=<]([\d.]+)/);
        return resolve({ ok: true, latencyMs: m ? Math.round(Number(m[1])) : Date.now() - t0 });
      }
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // ping binary missing: fall back to TCP 443 then 80
        return tcp({ ...spec, type: "tcp", target: `${host}:443` }).then((r) => (r.ok ? r : tcp({ ...spec, type: "tcp", target: `${host}:80` }))).then((r) => resolve({ ...r, error: r.ok ? undefined : "ping-unavailable" }));
      }
      resolve({ ok: false, latencyMs: null, error: "no reply" });
    });
  });
}

async function http(spec: CheckSpec): Promise<CheckOutcome> {
  try {
    const method = spec.httpMethod ?? "GET";
    let r = await safeFetch(spec.target, { method, timeoutMs: spec.timeoutMs, ignoreTls: spec.ignoreTls, maxBytes: 512 * 1024 });
    if (method === "HEAD" && (r.status === 405 || r.status === 501)) r = await safeFetch(spec.target, { method: "GET", timeoutMs: spec.timeoutMs, ignoreTls: spec.ignoreTls, maxBytes: 512 * 1024 });
    const okCode = statusMatches(r.status, spec.expectedStatus ?? "200-399");
    if (!okCode) return { ok: false, latencyMs: r.ms, code: r.status, error: `unexpected status ${r.status}` };
    if (spec.keyword && !r.text.includes(spec.keyword)) return { ok: true, degraded: true, latencyMs: r.ms, code: r.status, error: "keyword missing" };
    return { ok: true, latencyMs: r.ms, code: r.status, degraded: r.ms > spec.timeoutMs * 0.8 };
  } catch (e) {
    const err = e as Error;
    return { ok: false, latencyMs: null, error: err.name === "AbortError" ? "timeout" : err.message };
  }
}

export function runCheck(spec: CheckSpec): Promise<CheckOutcome> {
  switch (spec.type) {
    case "tcp": return tcp(spec).catch((e) => ({ ok: false, latencyMs: null, error: e.message }));
    case "ping": return ping(spec);
    default: return http(spec);
  }
}
