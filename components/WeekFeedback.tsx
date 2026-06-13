"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitFeedback, type FeedbackState } from "@/app/student/actions";
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
 * Thank-you popup shown after a persisted feedback submission — thanks the
 * student and names the points the feedback just earned (FR-025).
 */
function ThanksPopup({
  points,
  onClose,
}: {
  points: number;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
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
      aria-label={strings.studentFeedbackThanksTitle}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-lg sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
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
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">
          {strings.studentFeedbackThanksTitle}
        </h2>
        <p className="mt-2 text-2xl font-extrabold text-brand">
          {`${strings.studentFeedbackAwardedPrefix} ${points} ${strings.studentRewardsPointsUnit}`}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.closeLabel}
        </button>
      </div>
    </div>
  );
}

/** The card shown once feedback exists for this week — feedback is one-shot. */
function AlreadyGaveFeedback() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-surface p-6 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
        <svg
          width="24"
          height="24"
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
      <h2 className="text-lg font-bold text-ink">
        {strings.studentFeedbackAlreadyTitle}
      </h2>
      <p className="text-sm text-slate-500">
        {strings.studentFeedbackAlreadyNote}
      </p>
    </section>
  );
}

/**
 * Per-week "Give Feedback" card (client island, US5). Collects a session
 * rating, an overall instructor rating, and a free-text comment, persists them
 * via `submitFeedback` (one row per student per week — feedback is one-shot,
 * resubmission is blocked), and pops a thank-you naming the awarded points.
 * Once feedback exists for the week (`alreadySubmitted`, or a just-submitted
 * result), the form is replaced by a thank-you card.
 */
export default function WeekFeedback({
  weekId,
  alreadySubmitted = false,
}: {
  weekId: string;
  alreadySubmitted?: boolean;
}) {
  const [session, setSession] = useState(0);
  const [instructor, setInstructor] = useState(0);
  const [comment, setComment] = useState("");
  const [state, formAction, pending] = useActionState(
    submitFeedback,
    {} as FeedbackState
  );
  // The popup is dismissable; track which result was dismissed so it stays
  // closed while the thank-you card takes the form's place.
  const [dismissed, setDismissed] = useState<FeedbackState | null>(null);

  const showPopup = Boolean(state.saved) && state !== dismissed;

  // Feedback is one-shot: hide the form once a row exists for this week —
  // either already present on load, or just submitted in this session.
  if (alreadySubmitted || state.saved) {
    return (
      <>
        <AlreadyGaveFeedback />
        {showPopup ? (
          <ThanksPopup
            points={state.awardedPoints ?? 0}
            onClose={() => setDismissed(state)}
          />
        ) : null}
      </>
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

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="week_id" value={weekId} />
        <input type="hidden" name="session_rating" value={session || ""} />
        <input
          type="hidden"
          name="instructor_rating"
          value={instructor || ""}
        />

        {state.error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {state.error}
          </p>
        ) : null}

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
          name="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={strings.studentFeedbackCommentPlaceholder}
          className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-page p-4 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/30"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={
              pending ||
              (session === 0 && instructor === 0 && comment.trim() === "")
            }
            className="rounded-xl bg-brand px-6 py-3 text-xs font-bold text-white shadow-sm transition-all hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
          >
            {strings.studentFeedbackSubmitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
