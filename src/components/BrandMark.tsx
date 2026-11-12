/** The Homi mark: a roof over a 2x2 service grid. Ink follows the text color; the lit cell uses --brand-a (see src/app/brand.css). */
export function BrandMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="16 16.5 88 88" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M27 49 L60 24 L93 49" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="36" y="54" width="21" height="21" rx="5" fill="currentColor" />
      <rect x="63" y="54" width="21" height="21" rx="5" style={{ fill: "var(--brand-a)" }} />
      <rect x="36" y="81" width="21" height="21" rx="5" fill="currentColor" />
      <rect x="63" y="81" width="21" height="21" rx="5" fill="currentColor" />
    </svg>
  );
}
