/** Rank how well `query` matches `text`: higher is better, 0 means no match. Word starts beat substrings beat scattered letters. */
export function score(query: string, text: string): number {
  const q = query.trim().toLowerCase(), t = text.toLowerCase();
  if (!q) return 1;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const i = t.indexOf(q);
  if (i >= 0) return /[\s\-_./:]/.test(t[i - 1] ?? " ") ? 80 : 60;
  let at = 0;
  for (const ch of q) { at = t.indexOf(ch, at); if (at < 0) return 0; at++; }
  return 20;
}
