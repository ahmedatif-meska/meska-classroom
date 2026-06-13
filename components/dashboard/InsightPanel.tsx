import type { ReactNode } from "react";

export type InsightItem = { label: string; value: string; icon?: ReactNode };

/**
 * A titled group of labelled stats (feature 013) — used for the engagement and
 * content-volume panels. Server Component. Each item shows a label and a value
 * (a neutral "0" / "No responses yet" when its metric has no data).
 */
export default function InsightPanel({
  title,
  items,
}: {
  title: string;
  items: InsightItem[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            {item.icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                {item.icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <dd className="text-lg font-bold leading-tight text-ink">
                {item.value}
              </dd>
              <dt className="truncate text-xs font-medium text-slate-500">
                {item.label}
              </dt>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
