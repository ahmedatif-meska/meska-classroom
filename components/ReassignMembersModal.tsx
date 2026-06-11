"use client";

import { useActionState } from "react";
import {
  reassignMembers,
  type ReassignMembersState,
} from "@/app/admin/members/actions";
import strings from "@/lib/strings";

type Wave = { id: string; name: string };

const initialState: ReassignMembersState = {};

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * Wave picker for reassigning already-existing members (opened from MemberTable
 * for either one member or a checkbox multi-selection). The parent mounts it only
 * while open, so each opening starts from a fresh action state; `onClose(true)`
 * signals that at least one member was reassigned (the parent then clears its
 * selection — the refreshed roster no longer lists those rows as unassigned).
 */
export default function ReassignMembersModal({
  memberIds,
  waves,
  onClose,
}: {
  memberIds: string[];
  waves: Wave[];
  onClose: (reassigned: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    reassignMembers,
    initialState
  );
  const done = state.reassignedCount !== undefined;
  const reassignedAny = Boolean(state.reassignedCount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reassign-members-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="reassign-members-title" className="text-xl font-bold text-ink">
            {strings.reassignTitle}
          </h2>
          <button
            type="button"
            onClick={() => onClose(reassignedAny)}
            aria-label={strings.closeLabel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink">
              {state.reassignedCount} {strings.reassignSuccessLabel}
              {state.failedCount
                ? ` · ${state.failedCount} ${strings.reassignFailedCountLabel}`
                : ""}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onClose(reassignedAny)}
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {strings.bulkDoneLabel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              {memberIds.length} {strings.reassignSelectedLabel}.{" "}
              {strings.reassignSubtitle}
            </p>

            {state.error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            ) : null}

            <form action={formAction} className="mt-6 flex flex-col gap-5">
              {memberIds.map((id) => (
                <input key={id} type="hidden" name="member_ids" value={id} />
              ))}

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="reassign_wave_id"
                  className="text-sm font-bold text-ink"
                >
                  {strings.memberWaveLabel} *
                </label>
                <select
                  id="reassign_wave_id"
                  name="wave_id"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    {strings.memberWavePlaceholder}
                  </option>
                  {waves.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onClose(false)}
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
                    ? strings.reassignSubmittingLabel
                    : strings.reassignSubmitLabel}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
