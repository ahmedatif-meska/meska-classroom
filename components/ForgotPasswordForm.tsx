"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestPasswordReset,
  type RequestResetState,
} from "@/app/admin/actions";
import strings from "@/lib/strings";

const initialState: RequestResetState = {};

export default function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  if (state.sent) {
    return (
      <div className="mt-8 flex flex-col gap-5">
        <p
          role="alert"
          className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-ink"
        >
          {strings.resetLinkSent}
        </p>
        <Link
          href="/admin"
          className="text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
        >
          {strings.backToSignInLabel}
        </Link>
      </div>
    );
  }

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
        <label htmlFor="email" className="text-sm font-bold text-ink">
          {strings.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={strings.emailPlaceholder}
          className="rounded-full border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.forgotSendingLabel : strings.forgotSubmitLabel}
      </button>

      <Link
        href="/admin"
        className="text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
      >
        {strings.backToSignInLabel}
      </Link>
    </form>
  );
}
