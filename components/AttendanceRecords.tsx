"use client";

import { useMemo, useState } from "react";
import strings from "@/lib/strings";

/** Rows shown per page in the records table. */
const PAGE_SIZE = 10;

/** Page numbers to render: first, last, and a ±1 window, with "…" gaps. */
function pageItems(current: number, total: number): (number | "…")[] {
  const items: (number | "…")[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
      items.push(i);
    } else if (items[items.length - 1] !== "…") {
      items.push("…");
    }
  }
  return items;
}

export type AttendanceRecord = {
  id: string;
  student: string;
  email: string;
  wave: string;
  waveCategory: "online" | "offline";
  week: string;
  date: string;
  instructorRating: number | null;
  sessionRating: number | null;
  comment: string | null;
  feedbackGiven: boolean;
};

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";
const ALL = "all";

type Option = { value: string; label: string };

/** A labelled dropdown for one filter (enhancement #3 — replaces pill toggles). */
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
 * Client-side search + filter shell for the admin attendance records table.
 * Receives the full, RLS-bounded set of records from the server and narrows it
 * in memory by name/email search plus dropdown filters (wave, wave category,
 * feedback). Filtering is live; the Search button and Filters toggle mirror the
 * shared search-bar pattern (feature 012 enhancements #2–#6).
 */
export default function AttendanceRecords({
  records,
}: {
  records: AttendanceRecord[];
}) {
  const [query, setQuery] = useState("");
  const [wave, setWave] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [feedback, setFeedback] = useState<string>(ALL);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Distinct wave names present in the records — the wave filter's options.
  const waveOptions = useMemo<Option[]>(() => {
    const names = Array.from(new Set(records.map((r) => r.wave))).sort();
    return names.map((n) => ({ value: n, label: n }));
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (
        q &&
        !r.student.toLowerCase().includes(q) &&
        !r.email.toLowerCase().includes(q)
      )
        return false;
      if (wave !== ALL && r.wave !== wave) return false;
      if (category !== ALL && r.waveCategory !== category) return false;
      if (feedback === "given" && !r.feedbackGiven) return false;
      if (feedback === "none" && r.feedbackGiven) return false;
      return true;
    });
  }, [records, query, wave, category, feedback]);

  // A new search/filter result resets to the first page — done during render
  // (React's "adjust state when a prop changes" pattern) rather than an effect.
  const filterKey = `${query}|${wave}|${category}|${feedback}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  let effectivePage = page;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    effectivePage = 1;
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(effectivePage, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="mt-6">
      {/* Search bar — full-width input + Search + Filters (enhancement #4). */}
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
            placeholder={strings.attendanceSearchPlaceholder}
            aria-label={strings.attendanceSearchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-surface py-3 pl-11 pr-4 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>
        <button
          type="submit"
          className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.attendanceSearchButton}
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
          {strings.attendanceFiltersButton}
        </button>
      </form>

      {showFilters ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-surface p-4 sm:grid-cols-3">
          {waveOptions.length > 1 ? (
            <FilterSelect
              label={strings.attendanceFilterWaveLabel}
              value={wave}
              onChange={setWave}
              options={waveOptions}
            />
          ) : null}
          <FilterSelect
            label={strings.attendanceFilterCategoryLabel}
            value={category}
            onChange={setCategory}
            options={[
              { value: "offline", label: strings.attendanceCategoryOffline },
              { value: "online", label: strings.attendanceCategoryOnline },
            ]}
          />
          <FilterSelect
            label={strings.attendanceFilterFeedbackLabel}
            value={feedback}
            onChange={setFeedback}
            options={[
              { value: "given", label: strings.attendanceFilterFeedbackGiven },
              { value: "none", label: strings.attendanceFilterFeedbackNone },
            ]}
          />
        </div>
      ) : null}

      {/* The table is ALWAYS rendered (headers visible) — even with no records;
          the empty / no-match state is a row inside the body. */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
        {/* Horizontal scroll on narrow screens — confined to this element
            (no page-level sideways scroll, Principle IV). */}
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className={TH}>{strings.attendanceColStudent}</th>
                  <th className={TH}>{strings.attendanceColEmail}</th>
                  <th className={TH}>{strings.attendanceColWave}</th>
                  <th className={TH}>{strings.attendanceColCategory}</th>
                  <th className={TH}>{strings.attendanceColWeek}</th>
                  <th className={TH}>{strings.attendanceColDate}</th>
                  <th className={TH}>{strings.attendanceColInstructorRating}</th>
                  <th className={TH}>{strings.attendanceColSessionRating}</th>
                  <th className={TH}>{strings.attendanceColComment}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <p className="text-sm font-semibold text-ink">
                        {records.length === 0
                          ? strings.attendanceEmptyTitle
                          : strings.attendanceNoMatches}
                      </p>
                      {records.length === 0 ? (
                        <p className="mt-1 text-sm text-slate-400">
                          {strings.attendanceEmptyNote}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  paged.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className={`${TD} font-semibold text-ink`}>
                      {r.student}
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>
                      {r.email}
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.wave}</td>
                    <td className={TD}>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          r.waveCategory === "online"
                            ? "bg-brand/10 text-brand"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.waveCategory === "online"
                          ? strings.attendanceCategoryOnline
                          : strings.attendanceCategoryOffline}
                      </span>
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.week}</td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.date}</td>
                    <td className={`${TD} text-sm text-slate-500`}>
                      {r.instructorRating != null
                        ? `${r.instructorRating} ${strings.attendanceRatingScale}`
                        : strings.attendanceFeedbackNone}
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>
                      {r.sessionRating != null
                        ? `${r.sessionRating} ${strings.attendanceRatingScale}`
                        : strings.attendanceFeedbackNone}
                    </td>
                    <td className="max-w-xs whitespace-normal px-6 py-4 align-middle text-sm text-slate-500">
                      {r.comment ?? strings.attendanceFeedbackNone}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
      </div>

      {/* Pager — only when more than one page of results. */}
      {filtered.length > PAGE_SIZE ? (
        <nav
          aria-label={strings.attendanceTitle}
          className="mt-4 flex items-center justify-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.paginationPrevLabel}
          </button>

          {pageItems(safePage, pageCount).map((item, i) =>
            item === "…" ? (
              <span key={`gap-${i}`} className="px-2 text-sm text-slate-400">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                aria-label={`${strings.paginationGoToPage} ${item}`}
                aria-current={item === safePage ? "page" : undefined}
                className={`min-w-[2.25rem] rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  item === safePage
                    ? "bg-brand text-white shadow-[0_0_14px_rgba(27,91,255,0.45)]"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.paginationNextLabel}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
