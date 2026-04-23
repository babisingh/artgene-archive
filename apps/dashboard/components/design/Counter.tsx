"use client";

import { useState, useEffect } from "react";

interface CounterProps {
  to: number;
  suffix?: string;
  dur?: number;
}

export function Counter({ to, suffix = "", dur = 1200 }: CounterProps) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let start: number | undefined;
    let raf: number;

    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, dur]);

  return <>{n.toLocaleString()}{suffix}</>;
}
