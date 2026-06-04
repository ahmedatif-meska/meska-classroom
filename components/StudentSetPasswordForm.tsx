"use client";

import { useActionState } from "react";
import {
  setStudentPassword,
  type SetStudentPwState,
} from "@/app/student/actions";
import strings from "@/lib/strings";

const initialState: SetStudentPwState = {};

const inputClass =
  "rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function StudentSetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    setStudentPassword,
    initialState
  );

  return (
    <form className="mt-8 flex flex-col gap-5" action={formAction}>
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-bold text-ink">
          {strings.newPasswordLabel}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder={strings.passwordPlaceholder}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-sm font-bold text-ink">
          {strings.confirmPasswordLabel}
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          placeholder={strings.passwordPlaceholder}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending
          ? strings.studentSetPasswordSubmittingLabel
          : strings.studentSetPasswordSubmitLabel}
      </button>
    </form>
  );
}
