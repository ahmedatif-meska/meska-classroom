"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestStudentPasswordReset,
  type StudentRequestResetState,
} from "@/app/student/actions";
import strings from "@/lib/strings";

const initialState: StudentRequestResetState = {};

/**
 * Member forgot-password request form (US1) — mirrors the admin
 * ForgotPasswordForm but stays on the /student surface. The sent state is the
 * SAME neutral confirmation for any email (no enumeration, SC-002).
 */
export default function StudentForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestStudentPasswordReset,
    initialState
  );

  if (state.sent) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-ink">
            {strings.studentForgotSentTitle}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {strings.studentForgotSentNote}
          </p>
        </div>
        <Link
          href="/student"
          className="text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
        >
          {strings.backToSignInLabel}
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-8 flex flex-col gap-5 text-left" action={formAction}>
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-bold text-ink">
          {strings.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-lg border-none bg-slate-100 px-4 py-3 text-base text-ink placeholder:text-slate-400 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-brand px-6 py-4 text-base font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.forgotSendingLabel : strings.studentForgotSubmitLabel}
      </button>

      <Link
        href="/student"
        className="text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
      >
        {strings.backToSignInLabel}
      </Link>
    </form>
  );
}
