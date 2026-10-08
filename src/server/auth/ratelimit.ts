interface Bucket { fails: number; lockedUntil: number; windowStart: number }
const buckets = new Map<string, Bucket>();
const WINDOW = 60_000, MAX = 5;

/** Returns ms to wait, or 0 if allowed. */
export function checkLimit(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  return b && b.lockedUntil > now ? b.lockedUntil - now : 0;
}
export function recordFailure(key: string, now = Date.now()) {
  if (buckets.size > 1000) for (const [k, v] of buckets) if (v.lockedUntil < now && now - v.windowStart > WINDOW) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || now - b.windowStart > WINDOW) b = { fails: 0, lockedUntil: 0, windowStart: now };
  b.fails++;
  if (b.fails >= MAX) b.lockedUntil = now + Math.min(15 * 60_000, 30_000 * 2 ** (b.fails - MAX));
  buckets.set(key, b);
}
export function recordSuccess(key: string) { buckets.delete(key); }
export function resetLimits() { buckets.clear(); }
