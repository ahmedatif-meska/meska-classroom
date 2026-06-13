"use client";

import { useMemo, useState } from "react";
import strings from "@/lib/strings";

export type AttendanceRecord = {
  id: string;
  student: string;
  wave: string;
  week: string;
  date: string;
  method: "scan" | "csv";
  feedbackGiven: boolean;
};

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";
const ALL = "all";

type Option = { value: string; label: string };

/** A row of pill toggles for one filter (mirrors the Waves browser style). */
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
 * Client-side search + filter shell for the admin attendance records table.
 * Receives the full, RLS-bounded set of records from the server and narrows it
 * in memory by student search, wave, method, and whether the student gave
 * feedback for the recorded week (feature 012 enhancements #4/#5).
 */
export default function AttendanceRecords({
  records,
}: {
  records: AttendanceRecord[];
}) {
  const [query, setQuery] = useState("");
  const [wave, setWave] = useState<string>(ALL);
  const [method, setMethod] = useState<string>(ALL);
  const [feedback, setFeedback] = useState<string>(ALL);

  // Distinct wave names present in the records — the wave filter's options.
  const waveOptions = useMemo<Option[]>(() => {
    const names = Array.from(new Set(records.map((r) => r.wave))).sort();
    return names.map((n) => ({ value: n, label: n }));
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      if (q && !r.student.toLowerCase().includes(q)) return false;
      if (wave !== ALL && r.wave !== wave) return false;
      if (method !== ALL && r.method !== method) return false;
      if (feedback === "given" && !r.feedbackGiven) return false;
      if (feedback === "none" && r.feedbackGiven) return false;
      return true;
    });
  }, [records, query, wave, method, feedback]);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={strings.attendanceSearchPlaceholder}
          aria-label={strings.attendanceSearchPlaceholder}
          className="w-full rounded-2xl border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          {waveOptions.length > 1 ? (
            <FilterPills
              legend={strings.attendanceFilterWaveLabel}
              options={waveOptions}
              value={wave}
              onChange={setWave}
            />
          ) : null}
          <FilterPills
            legend={strings.attendanceFilterMethodLabel}
            options={[
              { value: "scan", label: strings.attendanceMethodScan },
              { value: "csv", label: strings.attendanceMethodCsv },
            ]}
            value={method}
            onChange={setMethod}
          />
          <FilterPills
            legend={strings.attendanceFilterFeedbackLabel}
            options={[
              { value: "given", label: strings.attendanceFilterFeedbackGiven },
              { value: "none", label: strings.attendanceFilterFeedbackNone },
            ]}
            value={feedback}
            onChange={setFeedback}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-surface p-10 text-center text-sm text-slate-500">
          {strings.attendanceNoMatches}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
          {/* Horizontal scroll on narrow screens — confined to this element
              (no page-level sideways scroll, Principle IV). */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className={TH}>{strings.attendanceColStudent}</th>
                  <th className={TH}>{strings.attendanceColWave}</th>
                  <th className={TH}>{strings.attendanceColWeek}</th>
                  <th className={TH}>{strings.attendanceColDate}</th>
                  <th className={TH}>{strings.attendanceColMethod}</th>
                  <th className={TH}>{strings.attendanceColFeedback}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className={`${TD} font-semibold text-ink`}>
                      {r.student}
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.wave}</td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.week}</td>
                    <td className={`${TD} text-sm text-slate-500`}>{r.date}</td>
                    <td className={TD}>
                      <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                        {r.method === "scan"
                          ? strings.attendanceMethodScan
                          : strings.attendanceMethodCsv}
                      </span>
                    </td>
                    <td className={TD}>
                      {r.feedbackGiven ? (
                        <span className="inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                          {strings.attendanceFeedbackGiven}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">
                          {strings.attendanceFeedbackNone}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
