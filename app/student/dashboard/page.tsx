import DashboardShell from "@/components/DashboardShell";
import MemberQrCode from "@/components/MemberQrCode";
import { createClient } from "@/lib/supabase/server";
import { cached } from "@/lib/cache/redis";
import { studentKey } from "@/lib/cache/keys";
import { memberInfoUrl, renderQrSvg } from "@/lib/members/qr";
import { signOutStudent } from "@/app/student/actions";
import strings from "@/lib/strings";

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

function StudentFooter({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();

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
          title={name}
        >
          {name}
        </span>
      </div>
      <form action={signOutStudent}>
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
          {strings.studentSignOutLabel}
        </button>
      </form>
    </>
  );
}

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

  const qrSvg = student ? await renderQrSvg(memberInfoUrl(student.id)) : null;
  const displayName = student?.full_name || user?.email || "";

  return (
    <DashboardShell
      panelName={strings.studentPanelName}
      footer={<StudentFooter name={displayName} />}
    >
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink">{strings.dashboardLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {strings.studentDashboardSubtitle}
        </p>

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
