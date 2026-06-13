"use client";

import { useActionState } from "react";
import {
  updatePointRule,
  type PointAction,
  type PointRuleState,
} from "@/app/admin/points/actions";
import strings from "@/lib/strings";

export type PointRule = { action: PointAction; points: number };

const initialState: PointRuleState = {};

const ACTION_LABELS: Record<PointAction, string> = {
  attendance: strings.pointsActionAttendance,
  assignment: strings.pointsActionAssignment,
  feedback: strings.pointsActionFeedback,
};

/** One editable rule row — its own form so each Save is independent. */
function RuleRow({ rule }: { rule: PointRule }) {
  const [state, formAction, pending] = useActionState(
    updatePointRule,
    initialState
  );
  const inputId = `points-${rule.action}`;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
    >
      <label
        htmlFor={inputId}
        className="text-sm font-bold text-ink sm:w-44 sm:shrink-0"
      >
        {ACTION_LABELS[rule.action]}
      </label>

      <input type="hidden" name="action" value={rule.action} />
      <input
        id={inputId}
        name="points"
        type="number"
        min={0}
        step={1}
        defaultValue={rule.points}
        className="w-full max-w-[140px] rounded-lg border border-slate-200 bg-surface px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending ? strings.pointsSavingLabel : strings.pointsSaveLabel}
        </button>
        {state.saved ? (
          <span className="text-sm font-medium text-green-600">
            {strings.pointsSavedNote}
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 sm:ml-auto"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * The editable points-award table (US4): one row per rewarded action. Values
 * govern every student's derived total (counts × CURRENT values, FR-029).
 */
export default function PointRulesTable({ rules }: { rules: PointRule[] }) {
  return (
    <div className="mt-6 max-w-2xl rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
      {rules.map((rule) => (
        <RuleRow key={rule.action} rule={rule} />
      ))}
    </div>
  );
}
