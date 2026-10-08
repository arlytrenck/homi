import net from "node:net";

export interface IpPolicy { allowLoopback: boolean }

function v4(ip: string): number[] | null {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null;
}

/** IPv4 inside an IPv4-mapped (::ffff:) or NAT64 (64:ff9b::) IPv6 address, in dotted or hex form (URL parsing yields hex). */
function embeddedV4(ip: string): string | null {
  const m = ip.match(/^(?:::ffff:|64:ff9b::)(.+)$/);
  if (!m) return null;
  if (net.isIPv4(m[1])) return m[1];
  const h = m[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!h) return null;
  const hi = parseInt(h[1], 16), lo = parseInt(h[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Returns a reason string if the resolved IP must never be contacted. */
export function blockedReason(ip: string, policy: IpPolicy): string | null {
  const lower = ip.toLowerCase();
  const mapped = embeddedV4(lower);
  if (mapped) return blockedReason(mapped, policy);
  if (net.isIPv4(ip)) {
    const [a, b] = v4(ip)!;
    if (a === 0) return "unspecified address";
    if (a === 169 && b === 254) return "link-local / cloud metadata address";
    if (a >= 224) return "multicast/reserved address";
    if (a === 127 && !policy.allowLoopback) return "loopback address (enable “Allow checks against loopback” in Settings)";
    return null;
  }
  if (net.isIPv6(ip)) {
    if (lower === "::") return "unspecified address";
    if (lower === "::1") return policy.allowLoopback ? null : "loopback address (enable “Allow checks against loopback” in Settings)";
    if (/^fe[89ab]/.test(lower)) return "link-local address";
    if (lower.startsWith("ff")) return "multicast address";
    return null;
  }
  return "not an IP address";
}
