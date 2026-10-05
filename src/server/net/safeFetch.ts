import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, request } from "undici";
import { blockedReason, type IpPolicy } from "./policy";
import { getSetting } from "@/server/settings";

export interface SafeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  ignoreTls?: boolean;
  maxBytes?: number;
  maxRedirects?: number;
  policy?: IpPolicy;
  signal?: AbortSignal;
}

export interface SafeResponse { status: number; headers: Record<string, string>; text: string; json<T = unknown>(): T; ms: number }
export type SafeFetch = (url: string, init?: SafeFetchInit) => Promise<SafeResponse>;

export class BlockedTargetError extends Error {}

const defaultPolicy = (): IpPolicy => {
  let fromSettings = false;
  try { fromSettings = getSetting("allowLoopback", false); } catch { /* db unavailable (e.g. unit tests) */ }
  return { allowLoopback: fromSettings || process.env.HOMI_ALLOW_LOOPBACK === "1" };
};

/** DNS lookup that rejects blocked IPs at connect time (defeats DNS rebinding). */
function guardedLookup(policy: IpPolicy): net.LookupFunction {
  return (hostname, opts, cb) => {
    dns.lookup(hostname, { ...opts, all: true }, (err, addrs) => {
      if (err) return (cb as any)(err);
      const list = addrs as dns.LookupAddress[];
      for (const a of list) {
        const why = blockedReason(a.address, policy);
        if (why) return (cb as any)(new BlockedTargetError(`Blocked target ${a.address}: ${why}`));
      }
      if ((opts as any).all) return (cb as any)(null, list);
      return (cb as any)(null, list[0].address, list[0].family);
    });
  };
}

export const safeFetch: SafeFetch = async (rawUrl, init = {}) => {
  const policy = init.policy ?? defaultPolicy();
  const max = init.maxBytes ?? 5 * 1024 * 1024;
  const maxRedirects = init.maxRedirects ?? 3;
  const started = Date.now();
  let url = new URL(rawUrl);
  let method = init.method ?? "GET";
  let body = init.body;

  for (let hop = 0; ; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedTargetError("Only http(s) URLs are allowed");
    if (url.username || url.password) throw new BlockedTargetError("Credentials in URL are not allowed");
    // IP literal hosts are validated up front; hostnames are validated in the lookup.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host)) {
      const why = blockedReason(host, policy);
      if (why) throw new BlockedTargetError(`Blocked target ${host}: ${why}`);
    }
    const agent = new Agent({
      connect: { lookup: guardedLookup(policy), rejectUnauthorized: !init.ignoreTls },
    });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 10_000);
    init.signal?.addEventListener("abort", () => ctl.abort(), { once: true });
    try {
      const res = await request(url, { method: method as any, headers: init.headers, body, dispatcher: agent, signal: ctl.signal });
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        await res.body.dump();
        if (hop >= maxRedirects) throw new BlockedTargetError("Too many redirects");
        url = new URL(String(res.headers.location), url);
        if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && method === "POST")) { method = "GET"; body = undefined; }
        continue;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of res.body) {
        size += (c as Buffer).length;
        if (size > max) { ctl.abort(); throw new Error("Response too large"); }
        chunks.push(c as Buffer);
      }
      const text = Buffer.concat(chunks).toString("utf8");
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
      return { status: res.statusCode, headers, text, json: <T>() => JSON.parse(text) as T, ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
      await agent.close().catch(() => {});
    }
  }
};
