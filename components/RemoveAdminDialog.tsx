"use client";

import { useActionState, useState } from "react";
import { removeAdmin, type RemoveAdminState } from "@/app/admin/actions";
import strings from "@/lib/strings";

const initialState: RemoveAdminState = {};

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function RemoveAdminDialog({
  adminId,
  adminEmail,
  adminName,
}: {
  adminId: string;
  adminEmail: string;
  adminName: string;
}) {
  const [open, setOpen] = useState(false);
  // Close the confirmation once removal succeeds (event-driven, not an effect).
  const [state, formAction, pending] = useActionState(
    async (prev: RemoveAdminState, formData: FormData) => {
      const result = await removeAdmin(prev, formData);
      if (result.removed) setOpen(false);
      return result;
    },
    initialState
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${strings.removeAdminSubmitLabel} — ${adminName}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <TrashIcon />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-title-${adminId}`}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg">
            <h2
              id={`remove-title-${adminId}`}
              className="text-lg font-bold text-ink"
            >
              {strings.removeAdminTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {strings.removeAdminConfirm}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {adminName} · {adminEmail}
            </p>

            {state.error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {strings.cancelLabel}
              </button>
              <form action={formAction}>
                <input type="hidden" name="target_id" value={adminId} />
                <input type="hidden" name="target_email" value={adminEmail} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                >
                  {pending
                    ? strings.removeAdminSubmittingLabel
                    : strings.removeAdminSubmitLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
