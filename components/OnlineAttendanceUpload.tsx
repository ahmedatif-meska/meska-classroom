"use client";

import { useActionState, useState } from "react";
import {
  importOnlineAttendance,
  type ImportState,
} from "@/app/admin/attendance/actions";
import type { AttendanceWaveOption } from "@/components/AttendancePanel";
import AttendanceTemplateButton from "@/components/AttendanceTemplateButton";
import { parseAttendanceCsv } from "@/lib/attendance/csv";
import strings from "@/lib/strings";

const initialState: ImportState = {};

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Online-wave attendance via the email-only CSV (US3). The file is read and
 * validated IN THE BROWSER (`parseAttendanceCsv`); only the email array is
 * submitted to the Server Action (research R4 — no file bytes, no Storage).
 */
export default function OnlineAttendanceUpload({
  waves,
}: {
  waves: AttendanceWaveOption[];
}) {
  const [waveId, setWaveId] = useState(waves[0]?.id ?? "");
  const [weekId, setWeekId] = useState(waves[0]?.weeks[0]?.id ?? "");
  const [emails, setEmails] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    importOnlineAttendance,
    initialState
  );

  const weeks = waves.find((w) => w.id === waveId)?.weeks ?? [];

  const onFile = async (file: File | null) => {
    setEmails([]);
    setParseError(null);
    if (!file) return;
    const result = parseAttendanceCsv(await file.text());
    if ("error" in result) {
      setParseError(result.error);
      return;
    }
    setEmails(result.emails);
  };

  if (waves.length === 0) return null;

  const skipReason = (reason: "unmatched" | "already") =>
    reason === "unmatched"
      ? strings.attendanceSkippedUnmatched
      : strings.attendanceSkippedAlready;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {parseError ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {parseError}
        </p>
      ) : null}
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {typeof state.marked === "number" ? (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm">
          <p className="font-semibold text-ink">
            {state.marked} {strings.attendanceImportSummary}
          </p>
          {state.skipped && state.skipped.length > 0 ? (
            <ul className="mt-1 list-inside list-disc text-slate-600">
              {state.skipped.map((s) => (
                <li key={s.email}>
                  {s.email} — {skipReason(s.reason)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="online-wave" className="text-sm font-bold text-ink">
          {strings.attendanceWaveLabel}
        </label>
        <select
          id="online-wave"
          name="wave_id"
          value={waveId}
          onChange={(e) => {
            const next = e.target.value;
            setWaveId(next);
            setWeekId(waves.find((w) => w.id === next)?.weeks[0]?.id ?? "");
          }}
          className={selectClass}
        >
          {waves.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="online-week" className="text-sm font-bold text-ink">
          {strings.attendanceWeekLabel}
        </label>
        <select
          id="online-week"
          name="week_id"
          value={weekId}
          onChange={(e) => setWeekId(e.target.value)}
          className={selectClass}
          disabled={weeks.length === 0}
        >
          {weeks.map((wk) => (
            <option key={wk.id} value={wk.id}>
              {wk.label}
            </option>
          ))}
        </select>
        {weeks.length === 0 ? (
          <p className="text-sm text-slate-500">
            {strings.attendanceNoWeeksNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="online-csv" className="text-sm font-bold text-ink">
          {strings.attendanceUploadLabel}
        </label>
        <input
          id="online-csv"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="rounded-lg border border-slate-200 bg-surface px-4 py-3 text-base text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        {emails.length > 0 ? (
          <p className="text-sm text-slate-500">
            {emails.length} {strings.attendanceCsvReadyNote}
          </p>
        ) : null}
      </div>

      <input type="hidden" name="emails" value={JSON.stringify(emails)} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || emails.length === 0 || weeks.length === 0}
          className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending
            ? strings.attendanceImportingLabel
            : strings.attendanceImportLabel}
        </button>
        <AttendanceTemplateButton />
      </div>
    </form>
  );
}
