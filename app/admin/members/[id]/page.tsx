import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import AttendancePanel, {
  type AttendanceWaveOption,
} from "@/components/AttendancePanel";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import strings from "@/lib/strings";

/**
 * Shown to a non-admin who opens the QR target directly (e.g. scans the code with a
 * phone camera instead of using the in-panel Scan QR button). Member PII stays
 * admin-only; this is a plain denial, not the admin shell.
 */
function Unauthorized() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-ink">
          {strings.memberInfoUnauthorizedTitle}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {strings.memberInfoUnauthorizedNote}
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.memberInfoUnauthorizedCta}
        </Link>
      </div>
    </main>
  );
}

type MemberDetail = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  tenant_id: string | null;
  tenant: { name: string } | { name: string }[] | null;
};

/**
 * The offline waves (newest first) with their weeks — the attendance panel's
 * dropdown data (US2). Weeks are labelled "Week N" with the week's own name
 * appended when set (same convention as the student sidebar).
 */
async function loadOfflineWaves(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<AttendanceWaveOption[]> {
  const { data: waveRows } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("type", "offline")
    .order("created_at", { ascending: false });
  const offline = (waveRows ?? []) as { id: string; name: string }[];
  if (offline.length === 0) return [];

  const { data: weekRows } = await supabase
    .from("wave_weeks")
    .select("id, tenant_id, position, title")
    .in(
      "tenant_id",
      offline.map((w) => w.id)
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

  return offline.map((w) => ({
    id: w.id,
    name: w.name,
    weeks: byTenant.get(w.id) ?? [],
  }));
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0 sm:flex sm:items-center sm:gap-6">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400 sm:w-40 sm:shrink-0">
        {label}
      </dt>
      <dd className="mt-1 break-words text-base text-ink sm:mt-0">
        {value || "—"}
      </dd>
    </div>
  );
}

export default async function MemberInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The QR target self-gates (it is intentionally not behind the proxy). A
  // non-admin — including someone scanning the code outside the panel — gets an
  // explicit denial instead of the member's PII.
  if (!assertAdminSession(user ? { user } : null).ok) {
    return <Unauthorized />;
  }

  const { data } = await supabase
    .from("students")
    .select(
      "id, full_name, whatsapp, email, status, tenant_id, tenant:tenants(name)"
    )
    .eq("id", id)
    .maybeSingle();

  const member = data as MemberDetail | null;
  // Attendance authoring data (US2) — only ever reached by an admin (gate above).
  const offlineWaves = member ? await loadOfflineWaves(supabase) : [];
  const tenant = member
    ? Array.isArray(member.tenant)
      ? member.tenant[0]
      : member.tenant
    : null;
  const statusLabel =
    member?.status === "active"
      ? strings.membersStatusActive
      : strings.membersStatusPending;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/members"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <Link
          href="/admin/members"
          className="text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
        >
          ← {strings.memberInfoBackLabel}
        </Link>

        {member ? (
          <>
            <div className="mt-4 max-w-2xl rounded-2xl bg-surface p-6 shadow-sm sm:p-8">
              <h1 className="text-2xl font-bold text-ink">
                {member.full_name || member.email}
              </h1>
              <dl className="mt-6">
                <Field label={strings.memberFullNameLabel} value={member.full_name} />
                <Field label={strings.memberWhatsappLabel} value={member.whatsapp} />
                <Field label={strings.emailLabel} value={member.email} />
                <Field label={strings.memberWaveLabel} value={tenant?.name ?? null} />
                <Field label={strings.memberInfoStatusLabel} value={statusLabel} />
              </dl>
            </div>
            <AttendancePanel
              studentId={member.id}
              waves={offlineWaves}
              defaultWaveId={member.tenant_id ?? undefined}
            />
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
            {strings.memberNotFound}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
