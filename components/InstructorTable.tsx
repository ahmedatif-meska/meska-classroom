"use client";

import { useState } from "react";
import Image from "next/image";
import strings from "@/lib/strings";
import { instructorImageUrl } from "@/lib/instructors/image";
import { reorderInstructors } from "@/app/admin/instructors/actions";
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

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}
function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  );
}

export default function InstructorTable({
  instructors,
}: {
  instructors: InstructorRow[];
}) {
  const [order, setOrder] = useState<InstructorRow[]>(instructors);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the server only when the SET of instructors changes (add or
  // remove) — not on a mere re-render — so a local drag/reorder is preserved.
  const membership = instructors.map((i) => i.id).slice().sort().join(",");
  const [seed, setSeed] = useState(membership);
  if (membership !== seed) {
    setSeed(membership);
    setOrder(instructors);
  }

  if (instructors.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.instructorsEmptyNote}
      </div>
    );
  }

  async function persist(next: InstructorRow[]) {
    setOrder(next);
    setError(null);
    const result = await reorderInstructors(next.map((r) => r.id));
    if (result.error) setError(result.error);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void persist(next);
  }

  // Drag preview: reorder live as the row passes over a new slot; persist on drop.
  function onDragOverRow(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...order];
    const [item] = next.splice(dragIndex, 1);
    next.splice(index, 0, item);
    setOrder(next);
    setDragIndex(index);
  }

  return (
    <div className="mt-6 space-y-3">
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className={`${TH} w-px`} aria-hidden="true" />
                <th className={TH}>{strings.instructorsColImage}</th>
                <th className={TH}>{strings.instructorsColName}</th>
                <th className={TH}>{strings.instructorsColAdded}</th>
                <th className={`${TH} text-right`}>
                  {strings.instructorsColActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {order.map((row, index) => (
                <tr
                  key={row.id}
                  data-instructor-row
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    onDragOverRow(index);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    void persist(order);
                  }}
                  className={`border-b border-slate-100 last:border-b-0 ${
                    dragIndex === index ? "bg-brand/5" : ""
                  }`}
                >
                  <td className={`${TD} pr-0`}>
                    <div className="flex items-center gap-1">
                      <span
                        aria-label={strings.instructorDragHandleLabel}
                        title={strings.instructorDragHandleLabel}
                        className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                      >
                        <GripIcon />
                      </span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(index, index - 1)}
                          disabled={index === 0}
                          aria-label={`${strings.instructorMoveUpLabel} — ${row.name}`}
                          title={strings.instructorMoveUpLabel}
                          className="rounded p-0.5 text-slate-400 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-30"
                        >
                          <Chevron up />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, index + 1)}
                          disabled={index === order.length - 1}
                          aria-label={`${strings.instructorMoveDownLabel} — ${row.name}`}
                          title={strings.instructorMoveDownLabel}
                          className="rounded p-0.5 text-slate-400 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-30"
                        >
                          <Chevron up={false} />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className={TD}>
                    <Thumb row={row} />
                  </td>

                  <td className={TD}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink">{row.name}</span>
                      {row.title ? (
                        <span className="text-sm text-slate-500">{row.title}</span>
                      ) : null}
                    </div>
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
    </div>
  );
}
