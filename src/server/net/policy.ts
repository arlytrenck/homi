import net from "node:net";

export interface IpPolicy { allowLoopback: boolean }

function v4(ip: string): number[] | null {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null;
}

/** Returns a reason string if the resolved IP must never be contacted. */
export function blockedReason(ip: string, policy: IpPolicy): string | null {
  const lower = ip.toLowerCase();
  const mapped = lower.startsWith("::ffff:") ? lower.slice(7) : null;
  if (mapped && net.isIPv4(mapped)) return blockedReason(mapped, policy);
  if (net.isIPv4(ip)) {
    const [a, b] = v4(ip)!;
    if (a === 0) return "unspecified address";
    if (a === 169 && b === 254) return "link-local / cloud metadata address";
    if (a >= 224) return "multicast/reserved address";
    if (a === 127 && !policy.allowLoopback) return "loopback address (enable allowLoopback in settings)";
    return null;
  }
  if (net.isIPv6(ip)) {
    if (lower === "::") return "unspecified address";
    if (lower === "::1") return policy.allowLoopback ? null : "loopback address (enable allowLoopback in settings)";
    if (/^fe[89ab]/.test(lower)) return "link-local address";
    if (lower.startsWith("ff")) return "multicast address";
    return null;
  }
  return "not an IP address";
}
