"use client";

import { useActionState } from "react";
import {
  resendMemberInvite,
  type ResendMemberState,
} from "@/app/admin/members/actions";
import strings from "@/lib/strings";

const initialState: ResendMemberState = {};

export default function ResendMemberButton({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(
    resendMemberInvite,
    initialState
  );

  if (state.sent) {
    return (
      <span role="status" className="text-xs font-medium text-brand">
        {strings.memberResendSentNote}
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="target_id" value={memberId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
      >
        {pending ? strings.memberResendSendingLabel : strings.memberResendInviteLabel}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs font-medium text-red-700">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
