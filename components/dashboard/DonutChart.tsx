import type { ChartDatum } from "@/lib/dashboard/types";

/**
 * Pure-SVG donut chart (feature 013) — no client JS, no chart library. Arc lengths
 * are proportional to each datum's value. The visible legend (dot + label + value)
 * doubles as the accessible text equivalent (FR-012); the <svg> also carries
 * role="img" + an aria-label summarizing the figures. Brand-consistent fills are
 * passed in by the caller. An all-zero input renders the empty state.
 */
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function DonutChart({
  title,
  data,
  colors,
  emptyLabel,
}: {
  title: string;
  data: ChartDatum[];
  colors: string[];
  emptyLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const summary = data.map((d) => `${d.label} ${d.value}`).join(", ");

  return (
    <figure className="rounded-2xl border border-slate-200 bg-surface p-5">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      {total === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <svg
            viewBox="0 0 100 100"
            className="h-32 w-32 shrink-0 -rotate-90"
            role="img"
            aria-label={`${title}: ${summary}`}
          >
            {(() => {
              let offset = 0;
              return data.map((d, i) => {
                const len = (d.value / total) * CIRCUMFERENCE;
                const seg = (
                  <circle
                    key={d.label}
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke={colors[i % colors.length]}
                    strokeWidth="14"
                    strokeDasharray={`${len} ${CIRCUMFERENCE - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return seg;
              });
            })()}
          </svg>
          <ul className="min-w-0 space-y-1.5 text-sm">
            {data.map((d, i) => (
              <li key={d.label} className="flex items-center gap-2 capitalize">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                  aria-hidden="true"
                />
                <span className="text-slate-600">{d.label}</span>
                <span className="font-semibold text-ink">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
