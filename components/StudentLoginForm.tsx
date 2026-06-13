"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInStudent, type StudentSignInState } from "@/app/student/actions";
import strings from "@/lib/strings";

const initialState: StudentSignInState = {};

const inputClass =
  "rounded-lg border-none bg-slate-100 px-4 py-3 text-base text-ink placeholder:text-slate-400 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function StudentLoginForm() {
  const [state, formAction, pending] = useActionState(
    signInStudent,
    initialState
  );

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
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-bold text-ink">
            {strings.passwordLabel}
          </label>
          <Link
            href="/student/forgot-password"
            className="text-[11px] font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.studentForgotPasswordLabel}
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={strings.passwordPlaceholder}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-brand px-6 py-4 text-base font-semibold text-white shadow-md transition-all duration-200 hover:opacity-90 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.studentSigningIn : strings.studentSignInLabel}
      </button>

      <p className="text-center text-[11px] italic text-slate-500">
        {strings.studentLoginIdIsEmailNote}
      </p>
    </form>
  );
}
