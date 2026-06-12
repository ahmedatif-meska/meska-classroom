"use client";

import { useMemo, useState } from "react";
import WaveCard from "@/components/WaveCard";
import type { WaveRow } from "@/lib/waves/content";
import { WAVE_STATUSES, WAVE_TYPES } from "@/lib/waves/validation";
import strings from "@/lib/strings";

export type WaveCardData = {
  wave: WaveRow;
  weekCount: number;
  studentCount: number;
};

const TYPE_LABELS: Record<(typeof WAVE_TYPES)[number], string> = {
  online: strings.waveTypeOnline,
  offline: strings.waveTypeOffline,
};
const STATUS_LABELS: Record<(typeof WAVE_STATUSES)[number], string> = {
  not_started: strings.waveStatusNotStarted,
  in_progress: strings.waveStatusInProgress,
  completed: strings.waveStatusCompleted,
};

type Option = { value: string; label: string };
const ALL = "all";

/** A row of pill toggles for a single filter (category or status). */
function FilterPills({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{legend}</legend>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {legend}
      </span>
      {[{ value: ALL, label: strings.wavesFilterAll }, ...options].map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            value === o.value
              ? "border-brand bg-brand/10 text-brand"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * Client-side search + filter shell for the Waves list. Receives the full,
 * RLS-bounded set of waves from the server and narrows it in memory by name
 * search, category (Online/Offline type) and lifecycle status.
 */
export default function WavesBrowser({ items }: { items: WaveCardData[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(({ wave }) => {
      if (q && !wave.name.toLowerCase().includes(q)) return false;
      if (category !== ALL && wave.type !== category) return false;
      if (status !== ALL && wave.status !== status) return false;
      return true;
    });
  }, [items, query, category, status]);

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={strings.wavesSearchPlaceholder}
          aria-label={strings.wavesSearchPlaceholder}
          className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          <FilterPills
            legend={strings.wavesFilterCategoryLabel}
            options={WAVE_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
            value={category}
            onChange={setCategory}
          />
          <FilterPills
            legend={strings.wavesFilterStatusLabel}
            options={WAVE_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            }))}
            value={status}
            onChange={setStatus}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-surface p-10 text-center text-sm text-slate-500">
          {strings.wavesNoMatches}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ wave, weekCount, studentCount }) => (
            <WaveCard
              key={wave.id}
              wave={wave}
              weekCount={weekCount}
              studentCount={studentCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
