"use client";

import { useState } from "react";
import Image from "next/image";
import strings from "@/lib/strings";

export type InstructorListItem = {
  id: string;
  name: string;
  title: string | null;
  imageUrl: string | null;
};

// How many instructors show before "View All" is needed.
const PREVIEW_COUNT = 2;

function Avatar({ item }: { item: InstructorListItem }) {
  if (item.imageUrl) {
    return (
      <Image
        src={item.imageUrl}
        alt={item.name}
        width={48}
        height={48}
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (item.name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-lg font-bold text-brand"
    >
      {initial}
    </span>
  );
}

/**
 * Compact instructor rows (avatar + name) with a "View All" toggle: only the
 * first PREVIEW_COUNT show until expanded; collapses back on "Show less". Client
 * Component — the page resolves image URLs server-side and passes plain data.
 */
export default function StudentInstructorsList({
  instructors,
}: {
  instructors: InstructorListItem[];
}) {
  const [expanded, setExpanded] = useState(false);
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
          <article
            key={item.id}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm"
          >
            <Avatar item={item} />
            <div className="min-w-0">
              <h3 className="truncate font-bold text-ink">{item.name}</h3>
              {item.title ? (
                <p className="truncate text-sm text-slate-500">{item.title}</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
