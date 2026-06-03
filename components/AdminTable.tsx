import strings from "@/lib/strings";
import { adminDisplayName } from "@/lib/auth/adminManagement";
import ResendInviteButton from "@/components/ResendInviteButton";
import RemoveAdminDialog from "@/components/RemoveAdminDialog";

export type AdminRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string;
};

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";

function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

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
      {active ? strings.adminMgmtStatusActive : strings.adminMgmtStatusPending}
    </span>
  );
}

export default function AdminTable({
  admins,
  currentUserId,
}: {
  admins: AdminRow[];
  currentUserId: string;
}) {
  if (admins.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
        {strings.adminMgmtEmptyNote}
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
      {/* Horizontal scroll on narrow screens — the table keeps its shape and the
          user swipes to reach the later columns (rather than reflowing to cards). */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className={TH}>{strings.adminMgmtColName}</th>
              <th className={TH}>{strings.adminMgmtColEmail}</th>
              <th className={TH}>{strings.adminMgmtColRole}</th>
              <th className={TH}>{strings.adminMgmtColStatus}</th>
              <th className={TH}>{strings.adminMgmtColCreated}</th>
              <th className={`${TH} text-right`}>
                {strings.adminMgmtColActions}
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => {
              const isSelf = a.id === currentUserId;
              const isPending = a.status === "pending";
              const name = adminDisplayName(a);
              return (
                <tr
                  key={a.id}
                  data-admin-row
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className={TD}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{name}</span>
                      {isSelf ? (
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {strings.adminMgmtYouBadge}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className={`${TD} text-sm text-slate-500`}>{a.email}</td>

                  <td className={TD}>
                    <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      {strings.adminMgmtRoleAdmin}
                    </span>
                  </td>

                  <td className={TD}>
                    <StatusChip status={a.status} />
                  </td>

                  <td className={`${TD} text-sm text-slate-500`}>
                    {formatCreated(a.created_at)}
                  </td>

                  <td className={TD}>
                    <div className="flex items-center justify-end gap-2">
                      {isPending ? (
                        <ResendInviteButton
                          adminId={a.id}
                          adminEmail={a.email}
                        />
                      ) : null}
                      {!isSelf ? (
                        <RemoveAdminDialog
                          adminId={a.id}
                          adminEmail={a.email}
                          adminName={name}
                        />
                      ) : null}
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
