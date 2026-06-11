"use client";

import { useReportClientError } from "@/lib/errors/useReportClientError";
import strings from "@/lib/strings";

export default function StudentError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  // Best-effort crash report into the central error log (009); failures are
  // swallowed inside the hook so the retry UX below is never affected.
  useReportClientError(error);
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <p className="text-[var(--color-ink)] font-medium">{strings.errorTitle}</p>
      <button
        onClick={reset}
        className="text-sm font-medium text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80"
      >
        {strings.errorRetryLabel}
      </button>
    </div>
  );
}
