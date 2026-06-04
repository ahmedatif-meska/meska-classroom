import Image from "next/image";
import strings from "@/lib/strings";
import { instructorImageUrl } from "@/lib/instructors/image";
import InstructorFormModal, {
  type InstructorRow,
} from "@/components/InstructorFormModal";
import RemoveInstructorDialog from "@/components/RemoveInstructorDialog";

export type { InstructorRow };

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";

function formatAdded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

function Thumb({ row }: { row: InstructorRow }) {
  const url = instructorImageUrl(row.image_path);
  if (url) {
    return (
      <Image
        src={url}
        alt={row.name}
        width={48}
        height={48}
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-xl object-cover"
      />
    );
  }
  const initial = (row.name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-lg font-bold text-brand"
    >
      {initial}
    </span>
  );
}

export default function InstructorTable({
  instructors,
}: {
  instructors: InstructorRow[];
}) {
  if (instructors.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.instructorsEmptyNote}
      </div>
    );
  }

  // A clean, scannable table — Photo / Name / Added / Actions. The description is
  // authored in the form but intentionally NOT shown here (it can be long HTML);
  // the table stays compact. On narrow screens it scrolls horizontally and keeps
  // its shape rather than reflowing (mirrors AdminTable).
  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className={TH}>{strings.instructorsColImage}</th>
              <th className={TH}>{strings.instructorsColName}</th>
              <th className={TH}>{strings.instructorsColAdded}</th>
              <th className={`${TH} text-right`}>
                {strings.instructorsColActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {instructors.map((row) => (
              <tr
                key={row.id}
                data-instructor-row
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className={TD}>
                  <Thumb row={row} />
                </td>

                <td className={TD}>
                  <span className="font-semibold text-ink">{row.name}</span>
                </td>

                <td className={`${TD} text-sm text-slate-500`}>
                  {formatAdded(row.created_at)}
                </td>

                <td className={TD}>
                  <div className="flex items-center justify-end gap-1">
                    <InstructorFormModal instructor={row} />
                    <RemoveInstructorDialog
                      instructorId={row.id}
                      instructorName={row.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
