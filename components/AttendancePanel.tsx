"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  markAttendance,
  type AttendanceState,
} from "@/app/admin/attendance/actions";
import strings from "@/lib/strings";

export type AttendanceWaveOption = {
  id: string;
  name: string;
  weeks: { id: string; label: string }[];
};

const initialState: AttendanceState = {};

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-surface px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function CheckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Success modal for a recorded attendance (US2): Next reopens the scanner on
 * the Attendance tab; Back returns to the admin home. Dismissable via Escape /
 * backdrop / the close control (FR-012/FR-013).
 */
function SuccessModal({ onClose }: { onClose: () => void }) {
  const nextRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={strings.attendanceSuccessTitle}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-lg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CheckIcon />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">
          {strings.attendanceSuccessTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {strings.attendanceSuccessNote}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            ref={nextRef}
            href="/admin/attendance?scan=1"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.attendanceNextLabel}
          </Link>
          <Link
            href="/admin/dashboard"
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.attendanceBackLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin-only attendance panel on the member-info page (the QR scan target,
 * US2): pick the offline wave (newest first; the student's own wave is
 * preselected) and the session's week, then Attend. The Server Action is the
 * authority for FR-015/FR-027/FR-028 — this UI only makes the golden path fast.
 */
export default function AttendancePanel({
  studentId,
  waves,
  defaultWaveId,
}: {
  studentId: string;
  waves: AttendanceWaveOption[];
  defaultWaveId?: string;
}) {
  const initialWaveId =
    defaultWaveId && waves.some((w) => w.id === defaultWaveId)
      ? defaultWaveId
      : (waves[0]?.id ?? "");
  const [waveId, setWaveId] = useState(initialWaveId);
  const [weekId, setWeekId] = useState(
    waves.find((w) => w.id === initialWaveId)?.weeks[0]?.id ?? ""
  );
  const [state, formAction, pending] = useActionState(
    markAttendance,
    initialState
  );
  // The success modal is dismissable (Escape/backdrop); track which result
  // object was dismissed so a NEW mark shows a fresh modal.
  const [dismissed, setDismissed] = useState<AttendanceState | null>(null);

  const weeks = waves.find((w) => w.id === waveId)?.weeks ?? [];
  const showModal = Boolean(state.marked) && state !== dismissed;

  if (waves.length === 0) return null;

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-ink">{strings.attendanceTitle}</h2>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="student_id" value={studentId} />

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.error}
          </p>
        ) : null}

        {state.alreadyAttended ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700">
              {strings.attendanceAlreadyTitle}
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              {strings.attendanceAlreadyNote}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="attendance-wave" className="text-sm font-bold text-ink">
            {strings.attendanceWaveLabel}
          </label>
          <select
            id="attendance-wave"
            name="wave_id"
            value={waveId}
            onChange={(e) => {
              const next = e.target.value;
              setWaveId(next);
              setWeekId(
                waves.find((w) => w.id === next)?.weeks[0]?.id ?? ""
              );
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
          <label htmlFor="attendance-week" className="text-sm font-bold text-ink">
            {strings.attendanceWeekLabel}
          </label>
          <select
            id="attendance-week"
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

        <button
          type="submit"
          disabled={pending || weeks.length === 0}
          className="mt-1 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending ? strings.attendanceMarkingLabel : strings.attendanceAttendLabel}
        </button>
      </form>

      {showModal ? <SuccessModal onClose={() => setDismissed(state)} /> : null}
    </section>
  );
}
