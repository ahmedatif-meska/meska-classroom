import Link from "next/link";
import type { WaveRow } from "@/components/WaveForm";
import { STATUS_META } from "@/components/WaveTags";
import strings from "@/lib/strings";

/**
 * One wave rendered as a card for the Waves list (Server Component). Shows the
 * name, an Online/Offline type badge, a colored lifecycle status tag, a
 * plain-text snippet of the description, and — below a divider — the number of
 * members assigned to the wave. The whole card links to the management page.
 */
export default function WaveCard({
  wave,
  weekCount,
  studentCount,
}: {
  wave: WaveRow;
  weekCount: number;
  studentCount: number;
}) {
  // Plain-text snippet from the sanitized HTML (cards never render raw markup).
  const snippet = wave.description_html
    ? wave.description_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  const typeLabel =
    wave.type === "online" ? strings.waveTypeOnline : strings.waveTypeOffline;
  const status = STATUS_META[wave.status] ?? STATUS_META.not_started;
  const studentsLabel =
    studentCount === 1 ? strings.waveStudentLabel : strings.waveStudentsLabel;

  return (
    <Link
      href={`/admin/waves/${wave.id}`}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-surface p-6 transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 truncate text-lg font-bold text-ink">
          {wave.name}
        </h2>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {typeLabel}
        </span>
        <span className="text-xs font-medium text-slate-400">
          {weekCount} {strings.waveWeeksLabel}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-500">
        {snippet || strings.waveNoDescription}
      </p>

      {/* Grey divider, then the assigned-member count with a people icon. */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-sm font-medium text-slate-600">
        <svg
          className="h-4 w-4 shrink-0 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>
          {studentCount} {studentsLabel}
        </span>
      </div>
    </Link>
  );
}
