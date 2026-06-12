import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import InstructorTable, {
  type InstructorRow,
} from "@/components/InstructorTable";
import InstructorFormModal from "@/components/InstructorFormModal";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import { cached } from "@/lib/cache/redis";
import { adminListKey } from "@/lib/cache/keys";
import strings from "@/lib/strings";

export default async function InstructorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const instructors = await cached(adminListKey("instructors"), async () => {
    const { data } = await supabase
      .from("instructors")
      .select("id, name, title, description_html, image_path, created_at, position")
      .order("position", { ascending: true });
    return (data ?? []) as InstructorRow[];
  });

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/instructors"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">
              {strings.instructorsTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {strings.instructorsSubtitle}
            </p>
          </div>
          <div className="shrink-0">
            <InstructorFormModal />
          </div>
        </div>

        <InstructorTable instructors={instructors} />
      </div>
    </DashboardShell>
  );
}
