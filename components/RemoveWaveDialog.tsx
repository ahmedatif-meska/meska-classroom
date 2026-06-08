"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWave, type RemoveWaveState } from "@/app/admin/waves/actions";
import strings from "@/lib/strings";

const initialState: RemoveWaveState = {};

/** Delete a wave: content cascades away and members are unassigned (kept). */
export default function RemoveWaveDialog({ waveId }: { waveId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: RemoveWaveState, formData: FormData) => {
      const result = await deleteWave(prev, formData);
      if (result.removed) {
        setOpen(false);
        router.push("/admin/waves");
      }
      return result;
    },
    initialState
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {strings.removeWaveSubmitLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-wave-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg">
            <h2 id="remove-wave-title" className="text-lg font-bold text-ink">
              {strings.removeWaveTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {strings.removeWaveConfirm}
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
                <input type="hidden" name="id" value={waveId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                >
                  {pending
                    ? strings.removeWaveSubmittingLabel
                    : strings.removeWaveSubmitLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
