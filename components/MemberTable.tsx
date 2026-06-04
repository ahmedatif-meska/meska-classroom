import Link from "next/link";
import strings from "@/lib/strings";
import ResendMemberButton from "@/components/ResendMemberButton";
import RemoveMemberDialog from "@/components/RemoveMemberDialog";

export type MemberRow = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  wave_name: string | null;
};

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";

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

export default function MemberTable({ members }: { members: MemberRow[] }) {
  if (members.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.membersEmptyNote}
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
      {/* Contained horizontal scroll on narrow screens — the table keeps its shape
          and the user swipes to reach later columns (the AdminTable pattern, not a
          card reflow). The page/body never scrolls sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
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
              return (
                <tr
                  key={m.id}
                  data-member-row
                  className="border-b border-slate-100 last:border-b-0"
                >
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
                    <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {m.wave_name}
                    </span>
                  </td>
                  <td className={TD}>
                    <StatusChip status={m.status} />
                  </td>
                  <td className={TD}>
                    <div className="flex items-center justify-end gap-2">
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
  );
}
