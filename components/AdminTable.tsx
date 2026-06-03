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

const COLS = "sm:grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_0.9fr_0.9fr]";

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
      {/* Header — desktop only; the rows reflow to cards below `sm`. */}
      <div
        className={`hidden border-b border-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid ${COLS} sm:gap-4`}
      >
        <span>{strings.adminMgmtColName}</span>
        <span>{strings.adminMgmtColEmail}</span>
        <span>{strings.adminMgmtColRole}</span>
        <span>{strings.adminMgmtColStatus}</span>
        <span>{strings.adminMgmtColCreated}</span>
        <span className="text-right">{strings.adminMgmtColActions}</span>
      </div>

      <ul>
        {admins.map((a) => {
          const isSelf = a.id === currentUserId;
          const isPending = a.status === "pending";
          const name = adminDisplayName(a);
          return (
            <li
              key={a.id}
              data-admin-row
              className={`grid grid-cols-1 gap-2 border-b border-slate-100 px-6 py-4 last:border-b-0 sm:items-center sm:gap-4 ${COLS}`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">{name}</span>
                {isSelf ? (
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {strings.adminMgmtYouBadge}
                  </span>
                ) : null}
              </div>

              <div className="truncate text-sm text-slate-500" title={a.email}>
                {a.email}
              </div>

              <div>
                <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                  {strings.adminMgmtRoleAdmin}
                </span>
              </div>

              <div>
                <StatusChip status={a.status} />
              </div>

              <div className="text-sm text-slate-500">
                {formatCreated(a.created_at)}
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                {isPending ? (
                  <ResendInviteButton adminId={a.id} adminEmail={a.email} />
                ) : null}
                {!isSelf ? (
                  <RemoveAdminDialog
                    adminId={a.id}
                    adminEmail={a.email}
                    adminName={name}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
