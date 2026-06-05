import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import MemberTable, { type MemberRow } from "@/components/MemberTable";
import AddMembersModal from "@/components/AddMembersModal";
import DownloadTemplateButton from "@/components/DownloadTemplateButton";
import ScanMemberButton from "@/components/ScanMemberButton";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

type StudentRow = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  tenant: { name: string } | { name: string }[] | null;
};

export type Wave = { id: string; name: string };

export default async function MembersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: studentData }, { data: waveData }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, whatsapp, email, status, created_at, tenant:tenants(name)")
      .order("created_at", { ascending: false }),
    supabase.from("tenants").select("id, name").order("name", { ascending: true }),
  ]);

  const members: MemberRow[] = ((studentData ?? []) as StudentRow[]).map((s) => {
    const tenant = Array.isArray(s.tenant) ? s.tenant[0] : s.tenant;
    return {
      id: s.id,
      full_name: s.full_name,
      whatsapp: s.whatsapp,
      email: s.email,
      status: s.status,
      wave_name: tenant?.name ?? null,
    };
  });

  const waves = (waveData ?? []) as Wave[];

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/members"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">
              {strings.membersTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {strings.membersSubtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ScanMemberButton />
            <DownloadTemplateButton />
            <AddMembersModal waves={waves} />
          </div>
        </div>

        <MemberTable members={members} />
      </div>
    </DashboardShell>
  );
}
