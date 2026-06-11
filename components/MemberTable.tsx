"use client";

import { useState } from "react";
import Link from "next/link";
import strings from "@/lib/strings";
import ResendMemberButton from "@/components/ResendMemberButton";
import RemoveMemberDialog from "@/components/RemoveMemberDialog";
import ReassignMembersModal from "@/components/ReassignMembersModal";

export type MemberRow = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  wave_name: string | null;
};

type Wave = { id: string; name: string };

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";
const checkboxClass =
  "size-5 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StatusChip({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1 text-sm font-medium text-green-600"
          : "inline-flex items-center gap-1 text-sm font-medium text-amber-600"
      }
    >
      {active ? <CheckIcon /> : null}
      {active ? strings.membersStatusActive : strings.membersStatusPending}
    </span>
  );
}

export default function MemberTable({
  members,
  waves,
}: {
  members: MemberRow[];
  waves: Wave[];
}) {
  // A null wave_name is an unassigned member (students.tenant_id is null — e.g.
  // their wave was deleted). Only those rows are selectable for reassignment.
  const unassigned = members.filter((m) => m.wave_name === null);
  const hasUnassigned = unassigned.length > 0;

  const [selected, setSelected] = useState<string[]>([]);
  // Ids handed to the modal: a single row's id (per-row Reassign) or the current
  // multi-selection. Null = modal closed; mounting fresh resets its action state.
  const [reassignTarget, setReassignTarget] = useState<string[] | null>(null);

  // After a successful reassign the server re-renders the roster and rows leave
  // the unassigned set; intersect so stale ids never count or get submitted.
  const selectedVisible = selected.filter((id) =>
    unassigned.some((m) => m.id === id)
  );
  const allSelected =
    hasUnassigned && selectedVisible.length === unassigned.length;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : unassigned.map((m) => m.id));
  }

  if (members.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.membersEmptyNote}
      </div>
    );
  }

  return (
    <>
      {hasUnassigned ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-slate-600">
            {selectedVisible.length} {strings.reassignSelectedLabel}
          </p>
          <button
            type="button"
            disabled={selectedVisible.length === 0}
            onClick={() => setReassignTarget(selectedVisible)}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            {strings.reassignToolbarLabel}
          </button>
        </div>
      ) : null}

      <div
        className={`${hasUnassigned ? "mt-3" : "mt-6"} overflow-hidden rounded-2xl bg-surface shadow-sm`}
      >
        {/* Contained horizontal scroll on narrow screens — the table keeps its shape
            and the user swipes to reach later columns (the AdminTable pattern, not a
            card reflow). The page/body never scrolls sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                {hasUnassigned ? (
                  <th className={TH}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={strings.reassignSelectAllAria}
                      className={checkboxClass}
                    />
                  </th>
                ) : null}
                <th className={TH}>{strings.membersColName}</th>
                <th className={TH}>{strings.membersColWhatsapp}</th>
                <th className={TH}>{strings.membersColEmail}</th>
                <th className={TH}>{strings.membersColWave}</th>
                <th className={TH}>{strings.membersColStatus}</th>
                <th className={`${TH} text-right`}>
                  {strings.membersColActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isPending = m.status === "pending";
                const isUnassigned = m.wave_name === null;
                return (
                  <tr
                    key={m.id}
                    data-member-row
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {hasUnassigned ? (
                      <td className={TD}>
                        {isUnassigned ? (
                          <input
                            type="checkbox"
                            checked={selected.includes(m.id)}
                            onChange={() => toggle(m.id)}
                            aria-label={`${strings.reassignSelectOneAria} ${m.full_name || m.email || ""}`}
                            className={checkboxClass}
                          />
                        ) : null}
                      </td>
                    ) : null}
                    <td className={TD}>
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="font-semibold text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
                      >
                        {m.full_name || m.email}
                      </Link>
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>
                      {m.whatsapp}
                    </td>
                    <td className={`${TD} text-sm text-slate-500`}>{m.email}</td>
                    <td className={TD}>
                      {m.wave_name ? (
                        <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                          {m.wave_name}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {strings.membersWaveUnassigned}
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <StatusChip status={m.status} />
                    </td>
                    <td className={TD}>
                      <div className="flex items-center justify-end gap-2">
                        {isUnassigned ? (
                          <button
                            type="button"
                            onClick={() => setReassignTarget([m.id])}
                            className="rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            {strings.reassignRowLabel}
                          </button>
                        ) : null}
                        {isPending && m.email ? (
                          <ResendMemberButton memberId={m.id} />
                        ) : null}
                        <Link
                          href={`/admin/members/${m.id}`}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          {strings.membersViewLabel}
                        </Link>
                        <RemoveMemberDialog
                          memberId={m.id}
                          memberName={m.full_name || m.email || ""}
                          memberEmail={m.email || ""}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reassignTarget ? (
        <ReassignMembersModal
          memberIds={reassignTarget}
          waves={waves}
          onClose={(reassigned) => {
            setReassignTarget(null);
            if (reassigned) setSelected([]);
          }}
        />
      ) : null}
    </>
  );
}
