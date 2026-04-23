interface HelixProps {
  animated?: boolean;
}

export function Helix({ animated: _animated = true }: HelixProps) {
  const points = 48;
  const w = 400, h = 400;
  const amp = 80;
  const cx = w / 2;

  const strandA: [number, number][] = [];
  const strandB: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const y = t * h;
    const phase = t * Math.PI * 5;
    strandA.push([cx + Math.sin(phase) * amp, y]);
    strandB.push([cx - Math.sin(phase) * amp, y]);
  }

  const bars: { x1: number; y1: number; x2: number; y2: number; back: boolean }[] = [];
  for (let i = 2; i < points; i += 3) {
    const [x1, y1] = strandA[i];
    const [x2, y2] = strandB[i];
    const back = Math.sin((i / points) * Math.PI * 5) > 0;
    bars.push({ x1, y1, x2, y2, back });
  }

  const basePairs = ["A-T", "G-C", "C-G", "T-A", "G-C", "A-T"];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <filter id="ink-blur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.3"/>
        </filter>
      </defs>
      {[180, 140, 100, 60].map((r, i) => (
        <circle key={r} cx={cx} cy={h / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth="0.3" opacity={0.6 - i * 0.1}/>
      ))}
      {Array.from({ length: 60 }).map((_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const r1 = 190, r2 = i % 5 === 0 ? 200 : 196;
        return (
          <line key={i}
            x1={cx + Math.cos(a) * r1} y1={h / 2 + Math.sin(a) * r1}
            x2={cx + Math.cos(a) * r2} y2={h / 2 + Math.sin(a) * r2}
            stroke="var(--ink-4)" strokeWidth="0.4"
          />
        );
      })}
      <polyline points={strandB.map(p => p.join(",")).join(" ")} fill="none" stroke="var(--ink-3)" strokeWidth="0.8" opacity="0.55"/>
      {bars.filter(b => b.back).map((b, i) => (
        <line key={"bb" + i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="var(--ink-4)" strokeWidth="0.5" opacity="0.7"/>
      ))}
      <polyline points={strandA.map(p => p.join(",")).join(" ")} fill="none" stroke="var(--ink)" strokeWidth="1.1"/>
      {bars.filter(b => !b.back).map((b, i) => (
        <line key={"bf" + i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke="var(--accent)" strokeWidth="0.7"/>
      ))}
      {bars.slice(0, 6).map((b, i) => (
        <text key={"t" + i} x={Math.max(b.x1, b.x2) + 6} y={b.y1 + 3} fontSize="7" fontFamily="var(--mono)" fill="var(--ink-4)" letterSpacing="0.05em">
          {basePairs[i]}
        </text>
      ))}
      {strandA.filter((_, i) => i % 6 === 0).map(([x, y], i) => (
        <circle key={"a" + i} cx={x} cy={y} r="2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="0.8"/>
      ))}
    </svg>
  );
}
