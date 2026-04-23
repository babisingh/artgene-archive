type PillarKind = "shield" | "wm" | "cert" | "star";

interface PillarIconProps {
  kind: PillarKind;
}

export function PillarIcon({ kind }: PillarIconProps) {
  if (kind === "shield") {
    return (
      <svg width="36" height="42" viewBox="0 0 36 42" fill="none" aria-hidden>
        <path d="M18 1 L35 7 V20 C35 31, 18 41, 18 41 C18 41, 1 31, 1 20 V7 L18 1Z" stroke="var(--ink)" strokeWidth="1" fill="var(--accent-soft)"/>
        <path d="M11 21 L16 26 L25 16" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  if (kind === "wm") {
    return (
      <svg width="42" height="32" viewBox="0 0 42 32" fill="none" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <rect key={i} x={i * 7} y={i % 2 === 0 ? 4 : 12} width="5" height="16" rx="1" fill={i % 2 === 0 ? "var(--accent)" : "var(--rule)"} opacity={i % 2 === 0 ? 1 : 0.6}/>
        ))}
      </svg>
    );
  }

  if (kind === "cert") {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <circle cx="18" cy="18" r="16" stroke="var(--ink)" strokeWidth="0.8" fill="var(--accent-soft)"/>
        <circle cx="18" cy="18" r="11" stroke="var(--accent)" strokeWidth="0.5" fill="none"/>
        <path d="M10 18 Q18 10, 26 18 M10 18 Q18 26, 26 18" stroke="var(--accent)" strokeWidth="1" fill="none"/>
        <circle cx="18" cy="18" r="2" fill="var(--accent)"/>
      </svg>
    );
  }

  // star
  return (
    <svg width="38" height="36" viewBox="0 0 38 36" fill="none" aria-hidden>
      <path d="M19 2 L23 13 L35 13 L25 21 L29 33 L19 26 L9 33 L13 21 L3 13 L15 13 Z" stroke="var(--ink)" strokeWidth="0.8" fill="var(--accent-soft)"/>
    </svg>
  );
}
