import type { WaveStatus } from "@/lib/waves/validation";
import strings from "@/lib/strings";

/** Status tag copy + color, one entry per lifecycle state. Shared single source
 *  of truth for both the Waves list (WaveCard) and the dashboard per-wave table. */
export const STATUS_META: Record<WaveStatus, { label: string; className: string }> = {
  not_started: {
    label: strings.waveStatusNotStarted,
    className: "bg-slate-100 text-slate-600",
  },
  in_progress: {
    label: strings.waveStatusInProgress,
    className: "bg-amber-100 text-amber-700",
  },
  completed: {
    label: strings.waveStatusCompleted,
    className: "bg-emerald-100 text-emerald-700",
  },
};

/** Colored lifecycle-status pill. */
export function WaveStatusTag({ status }: { status: WaveStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_started;
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

/** Brand-tinted Online/Offline type pill. */
export function WaveTypeTag({ type }: { type: "online" | "offline" }) {
  return (
    <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
      {type === "online" ? strings.waveTypeOnline : strings.waveTypeOffline}
    </span>
  );
}
