"use client";

import { useActionState, useRef, useState } from "react";
import {
  submitAssignment,
  type SubmissionState,
} from "@/app/student/dashboard/actions";
import { validateSubmissionFile } from "@/lib/waves/validation";
import strings from "@/lib/strings";

const initialState: SubmissionState = {};

/**
 * Student-side upload control for one assignment (client island). Pre-validates
 * the file type/size before the server action re-checks authoritatively. Shows a
 * "Submitted" badge once a submission exists (latest-wins replace).
 */
export default function SubmitAssignment({
  assignmentId,
  hasSubmission,
}: {
  assignmentId: string;
  hasSubmission: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: SubmissionState, formData: FormData) => {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        setClientError(strings.studentSubmissionInvalid);
        return prev;
      }
      const check = validateSubmissionFile({ type: file.type, size: file.size });
      if (!check.ok) {
        setClientError(check.error);
        return prev;
      }
      setClientError(null);
      const result = await submitAssignment(prev, formData);
      if (result.saved && fileRef.current) fileRef.current.value = "";
      return result;
    },
    initialState
  );

  const submitted = hasSubmission || state.saved;
  const error = clientError ?? state.error;

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <div className="flex flex-wrap items-center gap-3">
        {submitted ? (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            {strings.studentSubmissionDoneLabel}
          </span>
        ) : null}
        <input
          ref={fileRef}
          name="file"
          type="file"
          accept=".pdf,.ppt,.pptx,.doc,.docx"
          className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending
            ? strings.studentSubmittingLabel
            : submitted
              ? strings.studentSubmitReplaceLabel
              : strings.studentSubmitLabel}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {strings.studentSubmissionFileHelp}
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
