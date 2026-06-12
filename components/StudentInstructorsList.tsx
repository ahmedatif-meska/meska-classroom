"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import strings from "@/lib/strings";

export type InstructorListItem = {
  id: string;
  name: string;
  title: string | null;
  descriptionHtml: string | null;
  imageUrl: string | null;
};

// How many instructors show before "View All" is needed.
const PREVIEW_COUNT = 2;

function Avatar({ item, size }: { item: InstructorListItem; size: number }) {
  const dim = { width: size, height: size };
  if (item.imageUrl) {
    return (
      <Image
        src={item.imageUrl}
        alt={item.name}
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-full object-cover"
        style={dim}
      />
    );
  }
  const initial = (item.name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={dim}
      className="flex shrink-0 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand"
    >
      {initial}
    </span>
  );
}

/**
 * Modal showing one instructor's photo, name, title, and full (already-sanitized,
 * server-side) bio. Closes on Escape, backdrop tap, or the close control.
 */
function InstructorDetailModal({
  item,
  onClose,
}: {
  item: InstructorListItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="instructor-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar item={item} size={64} />
            <div className="min-w-0">
              <h2
                id="instructor-detail-title"
                className="truncate text-xl font-bold text-ink"
              >
                {item.name}
              </h2>
              {item.title ? (
                <p className="truncate text-sm text-slate-500">{item.title}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.closeLabel}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </div>

        {item.descriptionHtml ? (
          <div
            className="instructor-rte mt-5 text-sm text-slate-600"
            dangerouslySetInnerHTML={{ __html: item.descriptionHtml }}
          />
        ) : (
          <p className="mt-5 text-sm text-slate-400">
            {strings.studentInstructorNoBio}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact instructor rows (avatar + name + title) with a "View All" toggle: only
 * the first PREVIEW_COUNT show until expanded. Each row is a button that opens a
 * detail modal with the instructor's full bio. Client Component — the page
 * resolves image URLs and sanitizes the bio server-side and passes plain data.
 */
export default function StudentInstructorsList({
  instructors,
}: {
  instructors: InstructorListItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<InstructorListItem | null>(null);
  const canToggle = instructors.length > PREVIEW_COUNT;
  const visible =
    expanded || !canToggle ? instructors : instructors.slice(0, PREVIEW_COUNT);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">
          {strings.studentInstructorsTitle}
        </h2>
        {canToggle ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="rounded text-xs font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {expanded
              ? strings.studentInstructorsShowLessLabel
              : strings.studentInstructorsViewAllLabel}
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            aria-label={`${strings.studentInstructorViewDetailsLabel} — ${item.name}`}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-surface p-4 text-left shadow-sm transition-colors hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Avatar item={item} size={48} />
            <div className="min-w-0 flex-grow">
              <h3 className="truncate font-bold text-ink">{item.name}</h3>
              {item.title ? (
                <p className="truncate text-sm text-slate-500">{item.title}</p>
              ) : null}
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-slate-300"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      {selected ? (
        <InstructorDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
