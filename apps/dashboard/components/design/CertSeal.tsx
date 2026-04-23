interface CertSealProps {
  size?: number;
}

export function CertSeal({ size = 180 }: CertSealProps) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r1 = 92, r2 = i % 6 === 0 ? 98 : 95;
    return {
      x1: 100 + Math.cos(a) * r1,
      y1: 100 + Math.sin(a) * r1,
      x2: 100 + Math.cos(a) * r2,
      y2: 100 + Math.sin(a) * r2,
    };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="ArtGene Consortium certified provenance seal">
      <defs>
        <path id="seal-circle" d="M 100 100 m -78 0 a 78 78 0 1 1 156 0 a 78 78 0 1 1 -156 0"/>
      </defs>
      <g className="seal-ring">
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--ink)" strokeWidth="0.5"/>
        ))}
        <text fontSize="8.5" fontFamily="var(--mono)" letterSpacing="0.28em" fill="var(--ink-2)">
          <textPath href="#seal-circle" startOffset="0">
            ARTGENE CONSORTIUM · CERTIFIED PROVENANCE · 2026 · TAMPER EVIDENT ·
          </textPath>
        </text>
      </g>
      <circle cx="100" cy="100" r="62" fill="none" stroke="var(--ink)" strokeWidth="0.5"/>
      <circle cx="100" cy="100" r="52" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="0.5"/>
      <g transform="translate(100 100)">
        <path d="M -28 14 Q 0 -20, 28 14 M -28 -14 Q 0 20, 28 -14" stroke="var(--accent)" strokeWidth="1.2" fill="none"/>
        <circle r="3" fill="var(--accent)"/>
      </g>
      <text x="100" y="156" textAnchor="middle" fontSize="8" fontFamily="var(--mono)" letterSpacing="0.2em" fill="var(--ink-2)">AG·2026</text>
    </svg>
  );
}
