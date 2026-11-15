// A lens over a rising line: looking closely at a trend

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <circle cx="13.5" cy="13.5" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M20.5 20.5L28 28" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M7.5 17.5l3.5-3.5 2.5 2 5-5.5" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
