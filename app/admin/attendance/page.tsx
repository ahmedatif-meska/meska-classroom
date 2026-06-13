import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import ScanMemberButton from "@/components/ScanMemberButton";
import OnlineAttendanceUpload from "@/components/OnlineAttendanceUpload";
import type { AttendanceWaveOption } from "@/components/AttendancePanel";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

type AttendanceRow = {
  id: string;
  attended_on: string;
  method: string;
  student: { full_name: string | null; email: string | null } | null;
  tenant: { name: string } | null;
  week: { position: number; title: string | null } | null;
};

/** Bounded records read (Principle V) — the latest rows, newest day first. */
const RECORDS_LIMIT = 200;

const TH = "whitespace-nowrap px-6 py-3 font-semibold";
const TD = "whitespace-nowrap px-6 py-4 align-middle";

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
        "id, attended_on, method, student:students(full_name, email), tenant:tenants(name), week:wave_weeks(position, title)"
      )
      .order("attended_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(RECORDS_LIMIT),
    loadOnlineWaves(supabase),
  ]);

  const records = ((recordData ?? []) as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id as string,
      attended_on: row.attended_on as string,
      method: row.method as string,
      student: one(row.student as AttendanceRow["student"] | AttendanceRow["student"][]),
      tenant: one(row.tenant as AttendanceRow["tenant"] | AttendanceRow["tenant"][]),
      week: one(row.week as AttendanceRow["week"] | AttendanceRow["week"][]),
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

        {/* Offline — scan a member's QR (the scanner navigates to the member
            page, where the attendance panel records the mark). */}
        <section className="mt-6 max-w-2xl rounded-2xl bg-surface p-6 shadow-sm">
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
          <section className="mt-6 max-w-2xl rounded-2xl bg-surface p-6 shadow-sm">
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

        {/* Records */}
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
          <div className="mt-6 overflow-hidden rounded-2xl bg-surface shadow-sm">
            {/* Horizontal scroll on narrow screens — confined to this element
                (no page-level sideways scroll, Principle IV). */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className={TH}>{strings.attendanceColStudent}</th>
                    <th className={TH}>{strings.attendanceColWave}</th>
                    <th className={TH}>{strings.attendanceColWeek}</th>
                    <th className={TH}>{strings.attendanceColDate}</th>
                    <th className={TH}>{strings.attendanceColMethod}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className={`${TD} font-semibold text-ink`}>
                        {r.student?.full_name || r.student?.email || "—"}
                      </td>
                      <td className={`${TD} text-sm text-slate-500`}>
                        {r.tenant?.name ?? "—"}
                      </td>
                      <td className={`${TD} text-sm text-slate-500`}>
                        {weekLabel(r.week)}
                      </td>
                      <td className={`${TD} text-sm text-slate-500`}>
                        {r.attended_on}
                      </td>
                      <td className={TD}>
                        <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                          {r.method === "scan"
                            ? strings.attendanceMethodScan
                            : strings.attendanceMethodCsv}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
