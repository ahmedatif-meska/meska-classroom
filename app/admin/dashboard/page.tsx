import DashboardShell from "@/components/DashboardShell";
import strings from "@/lib/strings";
import { signOutAdmin } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/server";

function SignOutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function AdminSidebarFooter({ email }: { email: string }) {
  const initial = (email.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold text-ink"
          title={email}
        >
          {email}
        </span>
      </div>
      <form action={signOutAdmin}>
        <button
          type="submit"
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <SignOutIcon />
          </span>
          {strings.adminSignOutLabel}
        </button>
      </form>
    </>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      footer={<AdminSidebarFooter email={email} />}
    >
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink">{strings.dashboardLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {strings.adminDashboardSubtitle}
        </p>

        <div className="mt-10 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface py-24 text-sm text-slate-400">
          {strings.dashboardEmptyNote}
        </div>
      </div>
    </DashboardShell>
  );
}
