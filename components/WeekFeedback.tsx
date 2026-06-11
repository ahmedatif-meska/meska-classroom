"use client";

import { useState } from "react";
import strings from "@/lib/strings";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
    </svg>
  );
}

function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${strings.studentFeedbackStarsUnit}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange(n)}
            className={`rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              (hover || value) >= n ? "text-amber-400" : "text-slate-300"
            }`}
          >
            <StarIcon filled={(hover || value) >= n} />
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

/**
 * Per-week "Give Feedback" card (client island). Collects a session rating, an
 * overall instructor rating, and a free-text comment. UI-only for now — submit
 * shows a thank-you and nothing is persisted (no feedback table yet).
 */
export default function WeekFeedback() {
  const [session, setSession] = useState(0);
  const [instructor, setInstructor] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
          <svg
            width="22"
            height="22"
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
        </span>
        <p className="text-sm font-semibold text-ink">
          {strings.studentFeedbackThanks}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <FeedbackIcon />
        </span>
        <h2 className="text-lg font-bold text-ink">
          {strings.studentFeedbackTitle}
        </h2>
      </div>

      <p className="text-sm text-slate-500">{strings.studentFeedbackIntro}</p>

      <StarRating
        label={strings.studentFeedbackSessionLabel}
        value={session}
        onChange={setSession}
      />
      <StarRating
        label={strings.studentFeedbackInstructorLabel}
        value={instructor}
        onChange={setInstructor}
      />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={strings.studentFeedbackCommentPlaceholder}
        className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-page p-4 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/30"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={session === 0 && instructor === 0 && comment.trim() === ""}
          className="rounded-xl bg-brand px-6 py-3 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          {strings.studentFeedbackSubmitLabel}
        </button>
      </div>
    </section>
  );
}
