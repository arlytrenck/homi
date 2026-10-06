# Homi brand kit

Open [brandkit.html](brandkit.html) for the visual version. Color tokens live in [`src/app/brand.css`](../../src/app/brand.css); the app uses them directly.

## Essence

**Homi is a calm window onto your own infrastructure.** It is home-sized, not enterprise-sized: fast, quiet, and yours.

- Tagline: **A dashboard for your homelab.**
- Descriptor line: `self-hosted / at a glance / yours`
- Personality: calm, precise, a little nerdy. It tells you the state of things and gets out of the way.

### Voice

- Sentence case everywhere (buttons, headings, labels). No Title Case, no ALL CAPS except small section labels.
- Plain verbs: "Add service", "Test connection", "Sync now".
- State the problem and the fix: "Connection refused" or "TLS certificate not trusted (enable Ignore TLS errors for self-signed certs)". No "Oops", no exclamation marks, no emoji in the UI.
- Say "service", "check", "integration", "widget". Don't invent synonyms.

## Logo

The mark is a house (home) with a status dot at its center: the dot is a service that is alive. The wordmark repeats the idea: the dot of the **i** is the same dot.

| File | Use |
|---|---|
| `homi-logo.svg` / `.png` | App icon: rounded tile. Favicon, README, store listings. |
| `homi-mark.svg` | Mark alone, transparent, for **dark** surfaces. |
| `homi-mark-light.svg` | Mark alone for **light** surfaces (darker gradient). |
| `homi-mark-mono.svg` | One color via `currentColor`: print, embossing, single-color contexts. |
| `homi-wordmark.svg` | Wordmark alone (dark surfaces). |
| `homi-lockup.svg` / `homi-lockup-light.svg` | Tile + wordmark, horizontal. Light variant has a darker wordmark gradient for white backgrounds. |
| `homi-icon-maskable.svg` | Full-bleed PWA/Android icon; mark sits inside the 80% safe zone. |
| `homi-banner.svg` / `.png` | 1280×640 social/README banner. |

Regenerate the PNG icons with `node scripts/brand-render.mjs`.

### Rules

- **Clear space:** keep at least the width of the status dot's outer ring (about 1/5 of the mark's width) free on all sides.
- **Minimum size:** mark 16 px, lockup 96 px wide. Below 24 px use the tile (`homi-logo`), which holds up better than the bare mark.
- **Pick the variant by background**, not by taste. The dark-surface gradient (teal `#2dd4bf`) is only 1.9:1 on white; on white always use `homi-mark-light` or the tile.
- Don't recolor, rotate, outline, add shadows or glows, stretch, or change the gradient direction (teal top-left to indigo bottom-right).
- Don't put the mark on busy photos. Use the tile.
- Wordmark is lowercase: **homi**.

> Note: the wordmark SVGs use live text (Inter, with system fallbacks). For print or other places that need exact rendering, outline the text first.

## Color

| Token | Hex | Use |
|---|---|---|
| `navy-950` | `#0b1020` | Dark background, tile base, theme color |
| `navy-900` | `#111a2e` | Dark surfaces (cards) |
| `navy-800` | `#1e293b` | Tile gradient start |
| `teal-400` | `#2dd4bf` | Status dot, brand highlight **on dark** |
| `teal-600` | `#0d9488` | Brand teal on light (graphics only) |
| `teal-700` | `#0f766e` | Teal text on light |
| `indigo-400` | `#818cf8` | Accent on dark (buttons, focus, links) |
| `indigo-500` | `#6366f1` | Gradient end on dark |
| `indigo-600` | `#4f46e5` | Accent on light (buttons, focus, links) |

**Gradient:** teal to indigo at 45° (top-left to bottom-right). Dark surfaces use `teal-400 → indigo-500`; light surfaces use `teal-600 → indigo-600`. In code, `var(--brand-a)` and `var(--brand-b)` switch automatically with the theme.

**Accent:** `indigo-600` on light, `indigo-400` on dark. Primary buttons are white on `indigo-600` (6.3:1) and `navy-950` on `indigo-400` (6.4:1).

### Status colors

Status is semantic, separate from brand, and **never conveyed by color alone**: always pair with an icon or text.

| State | Icon | Notes |
|---|---|---|
| Up | check | green |
| Degraded | triangle | amber |
| Down | cross | red |
| Unknown | dash | gray |

Brand teal is deliberately not used for "up", so a green check never competes with the logo's dot.

### Contrast (WCAG)

| Pair | Ratio |
|---|---|
| `teal-400` on `navy-950` | 10.2 |
| `indigo-400` on `navy-950` | 6.4 |
| `indigo-500` on `navy-950` (graphics) | 4.2 |
| white on `indigo-600` | 6.3 |
| `indigo-600` on white | 6.3 |
| `teal-700` on white | 5.5 |
| `teal-600` on white (graphics only) | 3.7 |
| `teal-400` on white (**do not use**) | 1.9 |

## Typography

- **Inter** for UI and the wordmark (700, letter-spacing −3% on the wordmark). Fallback: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **JetBrains Mono** (fallback `ui-monospace, SFMono-Regular, Menlo, monospace`) for descriptor lines, URLs, code and technical labels.
- Two weights in the UI: 400 and 500 (600/700 only for the wordmark and hero text).
- Section labels: 11–12 px, uppercase, `letter-spacing: 0.04em`, muted color.

## Shape, space, motion

- Tile corner radius is 23% of its size (`28/120`). Cards `10 px`, controls `8 px`, dense mode `6 px`.
- Flat surfaces with a 1 px border; a single soft shadow only in light mode. No glows, no gradients on surfaces (the gradient is reserved for the logo).
- Icons: [Lucide](https://lucide.dev), 2 px stroke, round caps and joins, which matches the mark's 7/120 stroke.
- Motion: 150 ms ease-out for hover and focus. The status dot may pulse slowly while a check is running. Respect `prefers-reduced-motion`.
- Touch targets are at least 44 px on mobile.

## Where it is used in the product

- Favicon and PWA icons: `src/app/icon.svg`, `src/app/icon.png`, `src/app/apple-icon.png`, `public/icons/*`.
- Header and sign-in: `src/components/BrandMark.tsx` (theme-aware gradient).
- Theme color and manifest: `src/app/layout.tsx`, `src/app/manifest.ts` (`#0b1020`).
