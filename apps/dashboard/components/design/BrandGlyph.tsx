interface BrandGlyphProps {
  size?: number;
}

export function BrandGlyph({ size = 26 }: BrandGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="0.6" opacity="0.4"/>
      <path d="M8 8 Q16 16, 24 8 M8 24 Q16 16, 24 24" stroke="currentColor" strokeWidth="1" fill="none"/>
      <path d="M8 8 Q16 16, 24 8" stroke="var(--accent)" strokeWidth="1" fill="none"/>
      <circle cx="16" cy="16" r="1.4" fill="var(--accent)"/>
      <line x1="10" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="0.4" opacity="0.5"/>
      <line x1="10" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="0.4" opacity="0.5"/>
    </svg>
  );
}
