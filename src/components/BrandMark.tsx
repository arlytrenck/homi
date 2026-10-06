import { useId } from "react";

/** The Homi mark. Gradient stops follow the theme via --brand-a/--brand-b (see src/app/brand.css). */
export function BrandMark({ size = 28, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="18 18 84 84" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="28" y1="32" x2="92" y2="88">
          <stop offset="0" style={{ stopColor: "var(--brand-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-b)" }} />
        </linearGradient>
      </defs>
      <path d="M28 60 L60 32 L92 60 M38 51.25 V88 H82 V51.25" fill="none" stroke={`url(#${id})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="60" cy="67" r="11" style={{ fill: "var(--brand-a)" }} fillOpacity="0.18" />
      <circle cx="60" cy="67" r="5.5" style={{ fill: "var(--brand-a)" }} />
    </svg>
  );
}
