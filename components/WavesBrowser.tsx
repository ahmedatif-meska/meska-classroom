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

/** A labelled dropdown for one filter — mirrors the attendance page's FilterSelect. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <option value={ALL}>{strings.wavesFilterAll}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Client-side search + filter shell for the Waves list. Receives the full,
 * RLS-bounded set of waves from the server and narrows it in memory by name
 * search, category (Online/Offline type) and lifecycle status. The search bar
 * (full-width input + Search + Filters toggle revealing dropdowns) mirrors the
 * shared pattern used on the admin Attendance page.
 */
export default function WavesBrowser({ items }: { items: WaveCardData[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [showFilters, setShowFilters] = useState(false);

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
      {/* Search bar — full-width input + Search + Filters toggle. */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.wavesSearchPlaceholder}
            aria-label={strings.wavesSearchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-surface py-3 pl-11 pr-4 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.wavesSearchButton}
        </button>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M3 5h18l-7 8v6l-4 2v-8z" />
          </svg>
          {strings.wavesFiltersButton}
        </button>
      </form>

      {showFilters ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-surface p-4 sm:grid-cols-2">
          <FilterSelect
            label={strings.wavesFilterCategoryLabel}
            value={category}
            onChange={setCategory}
            options={WAVE_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
          />
          <FilterSelect
            label={strings.wavesFilterStatusLabel}
            value={status}
            onChange={setStatus}
            options={WAVE_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            }))}
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-surface p-10 text-center text-sm text-slate-500">
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
