import type { LeaderboardEntry } from "@/lib/dashboard/types";
import strings from "@/lib/strings";

/**
 * Top-N members by points (feature 013), already ranked desc and capped by the
 * aggregator. Pure text/markup — its rows are the text equivalent. Empty input
 * (no member has earned points yet) renders the empty state.
 */
export default function PointsLeaderboard({
  title,
  entries,
  emptyLabel,
}: {
  title: string;
  entries: LeaderboardEntry[];
  emptyLabel: string;
}) {
  return (
    <figure className="rounded-2xl border border-slate-200 bg-surface p-5">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      {entries.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {entries.map((e, i) => (
            <li key={e.studentId} className="flex items-center gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-700">{e.name}</span>
              <span className="shrink-0 font-semibold text-ink">
                {e.points} {strings.leaderboardPointsUnit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
