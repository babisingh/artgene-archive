"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  text: string;
  /** Optional wider tooltip for longer explanations */
  wide?: boolean;
}

/**
 * Small blue "i" icon that shows a tooltip on hover / focus.
 * Renders as an inline element so it sits naturally beside labels.
 */
export function InfoTooltip({ text, wide = false }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visible]);

  return (
    <span ref={ref} className="relative inline-block align-middle ml-1">
      <button
        type="button"
        aria-label="More information"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   bg-blue-100 text-blue-600 text-[10px] font-bold leading-none
                   hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400
                   dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-800/60
                   cursor-help select-none"
      >
        i
      </button>

      {visible && (
        <span
          role="tooltip"
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                      ${wide ? "w-72" : "w-56"}
                      rounded-lg border border-slate-200 dark:border-slate-600
                      bg-white dark:bg-slate-800 shadow-lg
                      text-xs text-slate-700 dark:text-slate-200
                      px-3 py-2 leading-relaxed pointer-events-none`}
        >
          {text}
          {/* arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
                            border-4 border-transparent border-t-white dark:border-t-slate-800" />
        </span>
      )}
    </span>
  );
}
