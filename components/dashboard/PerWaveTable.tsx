import type { WaveStat } from "@/lib/dashboard/types";
import { WaveStatusTag, WaveTypeTag } from "@/components/WaveTags";
import { formatPercent, formatRating } from "@/lib/dashboard/format";
import strings from "@/lib/strings";

/**
 * Per-wave breakdown table (feature 013). Built on the same contained-scroll
 * pattern as the admin tables (overflow-x-auto + min-w + data-admin-row): on
 * narrow screens the table scrolls inside its box rather than reflowing the page.
 * Rates/averages with no denominator render as "—". Long wave names truncate.
 */
const TH = "whitespace-nowrap px-5 py-3 font-semibold";
const TD = "whitespace-nowrap px-5 py-4 align-middle";

export default function PerWaveTable({ waves }: { waves: WaveStat[] }) {
  if (waves.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.perWaveEmptyNote}
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className={TH}>{strings.perWaveColName}</th>
              <th className={TH}>{strings.perWaveColType}</th>
              <th className={TH}>{strings.perWaveColStatus}</th>
              <th className={`${TH} text-right`}>{strings.perWaveColMembers}</th>
              <th className={`${TH} text-right`}>{strings.perWaveColAttendance}</th>
              <th className={`${TH} text-right`}>{strings.perWaveColSubmission}</th>
              <th className={`${TH} text-right`}>{strings.perWaveColRating}</th>
            </tr>
          </thead>
          <tbody>
            {waves.map((w) => (
              <tr
                key={w.id}
                data-admin-row
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className={`${TD} max-w-[260px]`}>
                  <span className="block truncate font-semibold text-ink">
                    {w.name}
                  </span>
                </td>
                <td className={TD}>
                  <WaveTypeTag type={w.type} />
                </td>
                <td className={TD}>
                  <WaveStatusTag status={w.status} />
                </td>
                <td className={`${TD} text-right text-sm font-medium text-slate-600`}>
                  {w.memberCount}
                </td>
                <td className={`${TD} text-right text-sm font-medium text-slate-600`}>
                  {formatPercent(w.attendanceRate)}
                </td>
                <td className={`${TD} text-right text-sm font-medium text-slate-600`}>
                  {formatPercent(w.submissionRate)}
                </td>
                <td className={`${TD} text-right text-sm font-medium text-slate-600`}>
                  {formatRating(w.avgRating)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
