import { notFound } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import StudentSidebarFooter from "@/components/StudentSidebarFooter";
import StudentWeekContent, { type Week } from "@/components/StudentWeekContent";
import { buildStudentNav } from "@/lib/students/nav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

export default async function StudentWeekPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? "";
  const tenantId = (user?.app_metadata?.tenant_id as string | undefined) ?? "";

  const { data: student } = userId
    ? await supabase
        .from("students")
        .select("id, full_name")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  // Load the week scoped to the caller's own wave. RLS already confines reads to
  // jwt_tenant_id(); the explicit tenant filter is defense-in-depth so a week id
  // from another wave resolves to null → notFound() (never renders foreign
  // content, Principle VI).
  const { data: week } = tenantId
    ? await supabase
        .from("wave_weeks")
        .select("id, title, position, description_html")
        .eq("id", weekId)
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null };

  if (!week || !student) notFound();

  const navItems = await buildStudentNav(tenantId);
  const displayName = student.full_name || user?.email || "";

  return (
    <DashboardShell
      panelName={strings.studentPanelName}
      navItems={navItems}
      activeHref={`/student/dashboard/weeks/${weekId}`}
      footer={<StudentSidebarFooter name={displayName} />}
    >
      <div className="p-8">
        <StudentWeekContent
          tenantId={tenantId}
          week={week as Week}
          studentId={student.id}
        />
      </div>
    </DashboardShell>
  );
}
