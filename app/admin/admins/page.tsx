import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import AdminTable, { type AdminRow } from "@/components/AdminTable";
import AddAdminModal from "@/components/AddAdminModal";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

export default async function AdminsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("admin_profiles")
    .select(
      "id, email, first_name, last_name, display_name, role, status, created_at"
    )
    .order("created_at", { ascending: false });

  const admins = (data ?? []) as AdminRow[];

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/admins"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">
              {strings.adminMgmtTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {strings.adminMgmtSubtitle}
            </p>
          </div>
          <div className="shrink-0">
            <AddAdminModal />
          </div>
        </div>

        <AdminTable admins={admins} currentUserId={user?.id ?? ""} />
      </div>
    </DashboardShell>
  );
}
