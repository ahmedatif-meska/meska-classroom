import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import WavesBrowser from "@/components/WavesBrowser";
import type { WaveRow } from "@/lib/waves/content";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

export default async function WavesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: waveData }, { data: weekData }, { data: studentData }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, name, description_html, type, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("wave_weeks").select("tenant_id"),
      supabase.from("students").select("tenant_id"),
    ]);

  const waves = (waveData ?? []) as WaveRow[];
  const weekCounts = new Map<string, number>();
  for (const w of weekData ?? []) {
    weekCounts.set(w.tenant_id, (weekCounts.get(w.tenant_id) ?? 0) + 1);
  }
  const studentCounts = new Map<string, number>();
  for (const s of studentData ?? []) {
    if (!s.tenant_id) continue; // unassigned members aren't tied to a wave
    studentCounts.set(s.tenant_id, (studentCounts.get(s.tenant_id) ?? 0) + 1);
  }

  const items = waves.map((wave) => ({
    wave,
    weekCount: weekCounts.get(wave.id) ?? 0,
    studentCount: studentCounts.get(wave.id) ?? 0,
  }));

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/waves"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink">{strings.wavesTitle}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {strings.wavesSubtitle}
            </p>
          </div>
          <div className="sm:shrink-0">
            <Link
              href="/admin/waves/new"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {strings.wavesAddLabel}
            </Link>
          </div>
        </div>

        {waves.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-surface p-10 text-center text-sm text-slate-500">
            {strings.wavesEmptyNote}
          </p>
        ) : (
          <WavesBrowser items={items} />
        )}
      </div>
    </DashboardShell>
  );
}
