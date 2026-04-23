interface CodonGridProps {
  rows?: number;
  cols?: number;
  highlights?: number[] | null;
}

export function CodonGrid({ rows = 8, cols = 16, highlights = null }: CodonGridProps) {
  const sig = "01101001101101001100101001110011100101100101110011100101001101100".replace(/ /g, "");
  const cells: { r: number; c: number; on: boolean; highlighted: boolean }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) % sig.length;
      const on = sig[idx] === "1";
      const flatIdx = r * cols + c;
      const highlighted = highlights ? highlights.includes(flatIdx) : false;
      cells.push({ r, c, on, highlighted });
    }
  }

  const cell = 14, gap = 3;
  const w = cols * (cell + gap);
  const h = rows * (cell + gap);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" aria-hidden>
      {cells.map(({ r, c, on, highlighted }, i) => (
        <rect
          key={i}
          x={c * (cell + gap)}
          y={r * (cell + gap)}
          width={cell}
          height={cell}
          rx="1"
          fill={highlighted ? "var(--verify)" : on ? "var(--accent)" : "var(--rule)"}
          opacity={on || highlighted ? 1 : 0.5}
        />
      ))}
    </svg>
  );
}
