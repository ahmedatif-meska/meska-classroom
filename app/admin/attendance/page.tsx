import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import ScanMemberButton from "@/components/ScanMemberButton";
import OnlineAttendanceUpload from "@/components/OnlineAttendanceUpload";
import AttendanceRecords, {
  type AttendanceRecord,
} from "@/components/AttendanceRecords";
import type { AttendanceWaveOption } from "@/components/AttendancePanel";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type AttendanceRow = {
  id: string;
  attended_on: string;
  method: string;
  student_id: string | null;
  week_id: string | null;
  student: { full_name: string | null; email: string | null } | null;
  tenant: { name: string; type: string } | null;
  week: { position: number; title: string | null } | null;
};

/** Bounded records read (Principle V) — the latest rows, newest day first. */
const RECORDS_LIMIT = 200;

/** Supabase embeds may arrive as object or single-element array — normalize. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function weekLabel(week: { position: number; title: string | null } | null) {
  if (!week) return "—";
  const numbered = `${strings.weekDefaultTitle} ${week.position}`;
  const name = week.title?.trim();
  return name && name !== numbered ? `${numbered} — ${name}` : numbered;
}

/** The online waves (newest first) with their weeks — the CSV section's data. */
async function loadOnlineWaves(
  supabase: SupabaseServer
): Promise<AttendanceWaveOption[]> {
  const { data: waveRows } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("type", "online")
    .order("created_at", { ascending: false });
  const online = (waveRows ?? []) as { id: string; name: string }[];
  if (online.length === 0) return [];

  const { data: weekRows } = await supabase
    .from("wave_weeks")
    .select("id, tenant_id, position, title")
    .in(
      "tenant_id",
      online.map((w) => w.id)
    )
    .order("position", { ascending: true });

  const byTenant = new Map<string, { id: string; label: string }[]>();
  for (const wk of (weekRows ?? []) as {
    id: string;
    tenant_id: string;
    position: number;
    title: string | null;
  }[]) {
    const numbered = `${strings.weekDefaultTitle} ${wk.position}`;
    const name = wk.title?.trim();
    const label = name && name !== numbered ? `${numbered} — ${name}` : numbered;
    const list = byTenant.get(wk.tenant_id) ?? [];
    list.push({ id: wk.id, label });
    byTenant.set(wk.tenant_id, list);
  }

  return online.map((w) => ({
    id: w.id,
    name: w.name,
    weeks: byTenant.get(w.id) ?? [],
  }));
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  const { scan } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: recordData }, onlineWaves] = await Promise.all([
    supabase
      .from("wave_attendance")
      .select(
        "id, attended_on, method, student_id, week_id, student:students(full_name, email), tenant:tenants(name, type), week:wave_weeks(position, title)"
      )
      .order("attended_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECORDS_LIMIT),
    loadOnlineWaves(supabase),
  ]);

  const rows = ((recordData ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      attended_on: row.attended_on as string,
      method: row.method as string,
      student_id: (row.student_id as string | null) ?? null,
      week_id: (row.week_id as string | null) ?? null,
      student: one(row.student as AttendanceRow["student"] | AttendanceRow["student"][]),
      tenant: one(row.tenant as AttendanceRow["tenant"] | AttendanceRow["tenant"][]),
      week: one(row.week as AttendanceRow["week"] | AttendanceRow["week"][]),
    };
  });

  // The feedback (ratings + comment) each (student, week) pair gave — drives the
  // instructor-rating / session-rating / comment columns (enhancement #2). One
  // bounded read over the same students/weeks already on screen; matched per row
  // by (student_id, week_id). A present row means feedback was given.
  type FeedbackValue = {
    session_rating: number | null;
    instructor_rating: number | null;
    comment: string | null;
  };
  const feedbackByPair = new Map<string, FeedbackValue>();
  const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
  const weekIds = [...new Set(rows.map((r) => r.week_id).filter(Boolean))];
  if (studentIds.length > 0 && weekIds.length > 0) {
    const { data: fb } = await supabase
      .from("wave_feedback")
      .select("student_id, week_id, session_rating, instructor_rating, comment")
      .in("student_id", studentIds as string[])
      .in("week_id", weekIds as string[]);
    for (const f of (fb ?? []) as ({ student_id: string; week_id: string } & FeedbackValue)[]) {
      feedbackByPair.set(`${f.student_id}:${f.week_id}`, {
        session_rating: f.session_rating,
        instructor_rating: f.instructor_rating,
        comment: f.comment,
      });
    }
  }

  const records: AttendanceRecord[] = rows.map((r) => {
    const fb =
      r.student_id != null && r.week_id != null
        ? feedbackByPair.get(`${r.student_id}:${r.week_id}`)
        : undefined;
    return {
      id: r.id,
      student: r.student?.full_name || r.student?.email || "—",
      email: r.student?.email ?? "—",
      wave: r.tenant?.name ?? "—",
      waveCategory: r.tenant?.type === "online" ? "online" : "offline",
      week: weekLabel(r.week),
      date: r.attended_on,
      instructorRating: fb?.instructor_rating ?? null,
      sessionRating: fb?.session_rating ?? null,
      comment: fb?.comment?.trim() || null,
      feedbackGiven: fb != null,
    };
  });

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/attendance"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">
            {strings.attendanceTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {strings.attendanceSubtitle}
          </p>
        </div>

        {/* Attendance tools — collapsible (minimized by default; auto-expands when
            returning to scan the next attendee). Native <details> = no extra JS. */}
        <details open={scan === "1"} className="group mt-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-surface px-6 py-4 shadow-sm [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink">
                {strings.attendanceToolsLabel}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {strings.attendanceToolsNote}
              </p>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>

          {/* Offline (scan a member's QR) and Online (email-only CSV import). */}
          <div
            className={`mt-4 grid gap-6 ${
              onlineWaves.length > 0 ? "lg:grid-cols-2 lg:items-start" : "max-w-2xl"
            }`}
          >
            {/* Offline — the scanner navigates to the member page, where the
                attendance panel records the mark. */}
            <section className="rounded-2xl bg-surface p-6 shadow-sm">
              <h2 className="text-lg font-bold text-ink">
                {strings.attendanceScanSectionTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {strings.attendanceScanSectionNote}
              </p>
              <div className="mt-4">
                <ScanMemberButton autoOpen={scan === "1"} />
              </div>
            </section>

            {/* Online — email-only CSV import. */}
            {onlineWaves.length > 0 ? (
              <section className="rounded-2xl bg-surface p-6 shadow-sm">
                <h2 className="text-lg font-bold text-ink">
                  {strings.attendanceOnlineSectionTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {strings.attendanceOnlineSectionNote}
                </p>
                <div className="mt-4">
                  <OnlineAttendanceUpload waves={onlineWaves} />
                </div>
              </section>
            ) : null}
          </div>
        </details>

        {/* Records table — the main view (searchable, filterable, paginated 10/page). */}
        {records.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center">
            <p className="text-sm font-semibold text-ink">
              {strings.attendanceEmptyTitle}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {strings.attendanceEmptyNote}
            </p>
          </div>
        ) : (
          <AttendanceRecords records={records} />
        )}
      </div>
    </DashboardShell>
  );
}
