import DashboardShell from "@/components/DashboardShell";
import MemberQrCode from "@/components/MemberQrCode";
import StudentSidebarFooter from "@/components/StudentSidebarFooter";
import StudentInstructors from "@/components/StudentInstructors";
import { buildStudentNav } from "@/lib/students/nav";
import { createClient } from "@/lib/supabase/server";
import { cached } from "@/lib/cache/redis";
import { studentKey } from "@/lib/cache/keys";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { memberInfoUrl, renderQrSvg } from "@/lib/members/qr";
import strings from "@/lib/strings";

export default async function StudentDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Cache the student's own row under a key scoped to BOTH their wave and user id, so
  // a cache hit is, by construction, that one student's data — never served across
  // waves or users (Principle VI). Skip caching if either id is missing.
  const userId = user?.id ?? "";
  const tenantId = (user?.app_metadata?.tenant_id as string | undefined) ?? "";

  const loadStudent = async () => {
    const { data } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  };

  const student =
    tenantId && userId
      ? await cached(studentKey(tenantId, userId, "profile"), loadStudent)
      : await loadStudent();

  // The caller's own wave (RLS scopes tenants to id = jwt_tenant_id()). Shown as
  // the wave name + description; a student never sees another wave (Principle VI).
  const { data: wave } = tenantId
    ? await supabase
        .from("tenants")
        .select("name, description_html")
        .eq("id", tenantId)
        .maybeSingle()
    : { data: null };

  // A QR render failure must not crash the whole dashboard — fall back to null.
  let qrSvg: string | null = null;
  if (student) {
    try {
      qrSvg = await renderQrSvg(memberInfoUrl(student.id));
    } catch {
      qrSvg = null;
    }
  }
  const displayName = student?.full_name || user?.email || "";
  const navItems = await buildStudentNav(tenantId);

  return (
    <DashboardShell
      panelName={strings.studentPanelName}
      navItems={navItems}
      activeHref="/student/dashboard"
      footer={<StudentSidebarFooter name={displayName} />}
    >
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink">
          {strings.studentHomeGreetingPrefix}
          {displayName}
          {strings.studentHomeGreetingSuffix}
        </h1>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink">
            {wave?.name
              ? `${strings.studentHomeWaveLabelPrefix}${wave.name}`
              : strings.studentNoWaveNote}
          </h2>
          {wave?.description_html ? (
            <div
              className="instructor-rte mt-2 rounded-2xl border border-slate-200 bg-surface p-6 text-sm text-ink"
              dangerouslySetInnerHTML={{
                __html: sanitizeDescription(wave.description_html),
              }}
            />
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {strings.dashboardEmptyNote}
            </p>
          )}
        </section>

        <StudentInstructors />

        <section className="mt-10 rounded-2xl border border-slate-200 bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">{strings.studentQrTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {strings.studentQrSubtitle}
          </p>
          <div className="mt-5">
            <MemberQrCode svg={qrSvg} />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
