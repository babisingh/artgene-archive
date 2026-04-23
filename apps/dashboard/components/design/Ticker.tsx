interface TickerItem {
  id: string;
  name: string;
  org: string;
  time: string;
}

interface TickerProps {
  items: TickerItem[];
}

export function Ticker({ items }: TickerProps) {
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        overflow: "hidden",
        borderTop: "0.5px solid var(--rule)",
        borderBottom: "0.5px solid var(--rule)",
        background: "var(--paper-2)",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "48px",
          padding: "10px 0",
          animation: "slide 60s linear infinite",
          whiteSpace: "nowrap",
        }}
      >
        {doubled.map((it, i) => (
          <span
            key={i}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              color: "var(--ink-2)",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ color: "var(--accent)" }}>▸</span>{" "}
            {it.id}{" "}
            <span style={{ color: "var(--ink-4)" }}>·</span>{" "}
            {it.name}{" "}
            <span style={{ color: "var(--ink-4)" }}>·</span>{" "}
            {it.org}{" "}
            <span style={{ color: "var(--ink-4)" }}>·</span>{" "}
            {it.time}
          </span>
        ))}
      </div>
    </div>
  );
}
