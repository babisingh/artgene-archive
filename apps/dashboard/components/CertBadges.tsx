/**
 * Shared certificate-level status and tier badges.
 * Used by the registry, sequences list, and certificate detail pages.
 *
 * Note: GateStatus badges (pass/fail/warn/skip) live locally in sequences/[id]/page.tsx
 * because they use a different type and colour palette.
 */

const TIER_COLORS: Record<string, string> = {
  FULL: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-400",
  STANDARD: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  REDUCED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
  MINIMAL: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  REJECTED: "badge-fail",
};

export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "CERTIFIED"
      ? "badge-pass"
      : status === "CERTIFIED_WITH_WARNINGS"
        ? "badge-warn"
        : status === "FAILED"
          ? "badge-fail"
          : "badge-skip";
  const label = status === "CERTIFIED_WITH_WARNINGS" ? "CERTIFIED (WARNINGS)" : status;
  return <span className={cls}>{label}</span>;
}

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`badge ${TIER_COLORS[tier] ?? "badge-skip"}`}>{tier}</span>
  );
}
