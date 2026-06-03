"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAdmin, type SignInState } from "@/app/admin/actions";
import strings from "@/lib/strings";

const initialState: SignInState = {};

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(signInAdmin, initialState);

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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-bold text-ink">
            {strings.passwordLabel}
          </label>
          <Link
            href="/admin/forgot-password"
            className="text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
          >
            {strings.forgotPasswordLabel}
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={strings.passwordPlaceholder}
          className="rounded-full border border-slate-200 bg-surface px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.adminSigningIn : strings.signInLabel}
      </button>

      <p className="text-center text-sm text-slate-500">
        {strings.protectedAccessNote}
      </p>
    </form>
  );
}
