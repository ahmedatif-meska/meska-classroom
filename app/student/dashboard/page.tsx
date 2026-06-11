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
      <div className="relative min-h-full overflow-hidden">
        {/* Ambient decorative backdrop — purely cosmetic, never interactive. */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -left-12 -top-24 h-72 w-72 rounded-full bg-brand opacity-10 blur-[100px]" />
          <div className="absolute -right-12 bottom-24 h-72 w-72 rounded-full bg-brand opacity-10 blur-[100px]" />
        </div>

        <div className="relative z-10 w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
          {/* Welcome */}
          <section className="space-y-1">
            <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight text-ink">
              {strings.studentHomeGreetingPrefix}
              {displayName}
              {strings.studentHomeGreetingSuffix}
            </h1>
            <p className="text-sm text-slate-500">
              {strings.studentHomeWelcomeSubtitle}
            </p>
          </section>

          {/* Current wave */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 border-l-4 border-l-brand bg-surface p-6 shadow-sm">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/10"
              aria-hidden="true"
            />
            <div className="relative">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-brand">
                {strings.studentHomeCurrentWaveLabel}
              </span>
              <h2 className="mb-1 text-xl font-bold text-ink">
                {wave?.name ?? strings.studentNoWaveNote}
              </h2>
              {wave?.description_html ? (
                <div
                  className="instructor-rte text-sm text-slate-600"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDescription(wave.description_html),
                  }}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  {strings.dashboardEmptyNote}
                </p>
              )}
            </div>
          </section>

          {/* My rewards — placeholder (no points feature yet) */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-brand/5 p-6 shadow-sm">
            <h2 className="text-base font-bold text-ink">
              {strings.studentRewardsTitle}
            </h2>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
              >
                <TrophyIcon />
              </span>
              <div className="text-2xl font-extrabold text-ink">
                {strings.studentRewardsPoints}
              </div>
            </div>
          </section>

          <StudentInstructors />

          {/* Check-in QR */}
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-surface p-6 text-center shadow-sm">
            <div>
              <h2 className="text-base font-bold text-ink">
                {strings.studentQrTitle}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {strings.studentQrSubtitle}
              </p>
            </div>
            <MemberQrCode svg={qrSvg} />
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2M17 6h2a2 2 0 0 1 0 4h-2" />
    </svg>
  );
}
