import type { ChartDatum } from "@/lib/dashboard/types";

/**
 * Pure-CSS horizontal bar chart (feature 013) — no client JS. Each bar's width is
 * proportional to its value relative to the largest. Labels and values are always
 * shown as text (the text equivalent, FR-012); long labels truncate. Empty input
 * renders the empty state.
 */
export default function BarChart({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: ChartDatum[];
  emptyLabel: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0);

  return (
    <figure className="rounded-2xl border border-slate-200 bg-surface p-5">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      {data.length === 0 || max === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((d) => (
            <li key={d.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-slate-600">{d.label}</span>
                <span className="shrink-0 font-semibold text-ink">{d.value}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max === 0 ? 0 : (d.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
