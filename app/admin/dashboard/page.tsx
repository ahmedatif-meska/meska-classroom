import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import strings from "@/lib/strings";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "";

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/dashboard"
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
