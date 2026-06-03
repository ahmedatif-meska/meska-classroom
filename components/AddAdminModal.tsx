"use client";

import { useActionState, useState } from "react";
import { createAdmin, type CreateAdminState } from "@/app/admin/actions";
import strings from "@/lib/strings";

const initialState: CreateAdminState = {};

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function AddAdminModal() {
  const [open, setOpen] = useState(false);
  // Close on a fully successful create from within the action (event-driven);
  // keep open with a warning if the invite email couldn't be sent (FR-021).
  const [state, formAction, pending] = useActionState(
    async (prev: CreateAdminState, formData: FormData) => {
      const result = await createAdmin(prev, formData);
      if (result.created && !result.inviteFailed) setOpen(false);
      return result;
    },
    initialState
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {strings.adminMgmtAddLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-admin-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-brand">
                <ShieldIcon />
                <h2
                  id="create-admin-title"
                  className="text-xl font-bold text-ink"
                >
                  {strings.createAdminTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.closeLabel}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {strings.createAdminSubtitle}
            </p>

            {state.created && state.inviteFailed ? (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
              >
                {strings.adminMgmtInviteNotSent}
              </p>
            ) : null}

            {state.error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            ) : null}

            <form action={formAction} className="mt-6 flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="first_name"
                    className="text-sm font-bold text-ink"
                  >
                    {strings.firstNameLabel} *
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    autoComplete="given-name"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="last_name"
                    className="text-sm font-bold text-ink"
                  >
                    {strings.lastNameLabel} *
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    autoComplete="family-name"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-bold text-ink">
                  {strings.emailLabel} *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={strings.emailPlaceholder}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="role" className="text-sm font-bold text-ink">
                  {strings.adminMgmtColRole} *
                </label>
                <select
                  id="role"
                  name="role"
                  defaultValue="admin"
                  className={inputClass}
                >
                  <option value="admin">{strings.adminMgmtRoleAdmin}</option>
                </select>
                <p className="text-xs text-slate-500">
                  {strings.adminMgmtRoleHelp}
                </p>
              </div>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {strings.cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                >
                  {pending
                    ? strings.createAdminSubmittingLabel
                    : strings.createAdminSubmitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
