import type { ReactNode } from "react";

/**
 * A headline KPI card (feature 013): a brand-tinted icon, a large value, a label,
 * and an optional secondary line (e.g. the online/offline split). Server Component.
 */
export default function StatCard({
  label,
  value,
  icon,
  sublabel,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  sublabel?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-surface p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-ink">{value}</p>
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        {sublabel ? (
          <p className="mt-0.5 truncate text-xs text-slate-400">{sublabel}</p>
        ) : null}
      </div>
    </div>
  );
}
