/** Pure label parsing for Docker auto-discovery. */
export interface DockerContainer {
  Id: string;
  Names?: string[];
  Labels?: Record<string, string>;
  Ports?: { PrivatePort: number; PublicPort?: number; Type?: string; IP?: string }[];
}

export interface Discovered {
  key: string; // stable across container recreation: the container name
  name: string;
  group: string | null;
  url: string;
  icon: string | null;
  description: string | null;
  hiddenPublic: boolean;
  check: { type: "http" | "tcp" | "ping"; target: string } | null;
}
export type ParseResult = { ok: true; value: Discovered } | { ok: false; key: string; reason: string } | null;

const truthy = (v?: string) => v !== undefined && ["true", "1", "yes"].includes(v.toLowerCase());
const httpUrl = (u: string) => { try { return ["http:", "https:"].includes(new URL(u).protocol); } catch { return false; } };

/** Returns null when the container has not opted in. */
export function parseContainer(c: DockerContainer, opts: { host?: string }): ParseResult {
  const L = c.Labels ?? {};
  if (!truthy(L["homi.enable"])) return null;
  const key = (c.Names?.[0] ?? c.Id).replace(/^\//, "");
  const fail = (reason: string): ParseResult => ({ ok: false, key, reason });

  let url = L["homi.url"]?.trim();
  if (!url) {
    const port = c.Ports?.find((p) => p.PublicPort && p.Type !== "udp");
    if (!port) return fail("No homi.url label and no published port");
    if (!opts.host) return fail("No homi.url label; set HOMI_DISCOVERY_HOST to derive URLs from published ports");
    url = `http://${opts.host}:${port.PublicPort}`;
  }
  if (!httpUrl(url)) return fail(`homi.url must be an http(s) URL (got “${url.slice(0, 60)}”)`);

  const kind = (L["homi.check"] ?? "http").toLowerCase();
  let check: Discovered["check"];
  if (kind === "none") check = null;
  else if (kind === "http") check = { type: "http", target: L["homi.check.target"]?.trim() || url };
  else if (kind === "tcp" || kind === "ping") {
    const t = L["homi.check.target"]?.trim();
    if (kind === "tcp" && !t) return fail("homi.check=tcp needs homi.check.target (host:port)");
    check = { type: kind, target: t || new URL(url).hostname };
  } else return fail(`Unknown homi.check “${kind.slice(0, 20)}” (use http, tcp, ping or none)`);
  if (check?.type === "http" && !httpUrl(check.target)) return fail("homi.check.target must be an http(s) URL for http checks");

  return {
    ok: true,
    value: {
      key, url, check,
      name: L["homi.name"]?.trim() || key,
      group: L["homi.group"]?.trim() || null,
      icon: L["homi.icon"]?.trim() || null,
      description: L["homi.description"]?.trim() || null,
      hiddenPublic: L["homi.public"] !== undefined && !truthy(L["homi.public"]),
    },
  };
}
