export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M16 3a13 13 0 0 1 0 26a9 13 0 0 0 0-26z" fill="currentColor" />
      <circle cx="16" cy="16" r="2" fill="var(--accent)" />
    </svg>
  );
}
