"use client";

import { useActionState } from "react";
import {
  updateAdminPassword,
  type UpdatePasswordState,
} from "@/app/admin/actions";
import strings from "@/lib/strings";

const initialState: UpdatePasswordState = {};

export default function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    updateAdminPassword,
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
          className="rounded-full border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
          className="rounded-full border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.resetUpdatingLabel : strings.resetSubmitLabel}
      </button>
    </form>
  );
}
