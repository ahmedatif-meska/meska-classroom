import { notFound } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import EditWaveModal from "@/components/EditWaveModal";
import RemoveWaveDialog from "@/components/RemoveWaveDialog";
import WaveWeeks, {
  type AdminWeek,
  type AdminAssignment,
} from "@/components/WaveWeeks";
import type { WaveRow } from "@/components/WaveForm";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import {
  signedUrl,
  MATERIALS_BUCKET,
  SUBMISSIONS_BUCKET,
} from "@/lib/waves/files";
import strings from "@/lib/strings";

type SubmissionRow = {
  assignment_id: string;
  file_path: string;
  student: { full_name: string | null } | { full_name: string | null }[] | null;
};

export default async function WaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: wave } = await supabase
    .from("tenants")
    .select("id, name, description_html, type, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!wave) notFound();
  const typed = wave as WaveRow;

  const [{ data: weekData }, { data: matData }, { data: asgData }, { data: subData }] =
    await Promise.all([
      supabase
        .from("wave_weeks")
        .select("id, title, position, description_html")
        .eq("tenant_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("wave_materials")
        .select("id, week_id, title, file_path")
        .eq("tenant_id", id),
      supabase
        .from("wave_assignments")
        .select("id, week_id, title, instructions_html, due_at")
        .eq("tenant_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("wave_submissions")
        .select("assignment_id, file_path, student:students(full_name)")
        .eq("tenant_id", id),
    ]);

  const materials = matData ?? [];
  const assignments = asgData ?? [];
  const submissions = (subData ?? []) as SubmissionRow[];

  // Pre-sign all admin download URLs (admin passes the Storage policies).
  const matUrl = new Map<string, string | null>();
  await Promise.all(
    materials.map(async (m) => {
      matUrl.set(m.id, await signedUrl(supabase, MATERIALS_BUCKET, m.file_path));
    })
  );
  const subByAssignment = new Map<
    string,
    { studentName: string; url: string | null }[]
  >();
  await Promise.all(
    submissions.map(async (s) => {
      const st = Array.isArray(s.student) ? s.student[0] : s.student;
      const url = await signedUrl(supabase, SUBMISSIONS_BUCKET, s.file_path);
      const list = subByAssignment.get(s.assignment_id) ?? [];
      list.push({ studentName: st?.full_name ?? "—", url });
      subByAssignment.set(s.assignment_id, list);
    })
  );

  const weeks: AdminWeek[] = (weekData ?? []).map((w) => ({
    id: w.id,
    title: w.title,
    position: w.position,
    description_html: w.description_html,
    materials: materials
      .filter((m) => m.week_id === w.id)
      .map((m) => ({ id: m.id, title: m.title, url: matUrl.get(m.id) ?? null })),
    assignments: assignments
      .filter((a) => a.week_id === w.id)
      .map(
        (a): AdminAssignment => ({
          id: a.id,
          title: a.title,
          instructions_html: a.instructions_html,
          due_at: a.due_at,
          submissions: subByAssignment.get(a.id) ?? [],
        })
      ),
  }));

  const typeLabel =
    typed.type === "online" ? strings.waveTypeOnline : strings.waveTypeOffline;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/waves"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <Link
          href="/admin/waves"
          className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ← {strings.wavesTitle}
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-ink">{typed.name}</h1>
              <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                {typeLabel}
              </span>
            </div>
            {typed.description_html ? (
              <div
                className="instructor-rte mt-3 text-sm text-ink"
                dangerouslySetInnerHTML={{ __html: typed.description_html }}
              />
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {strings.waveNoDescription}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
            <EditWaveModal wave={typed} />
            <RemoveWaveDialog waveId={typed.id} />
          </div>
        </div>

        <WaveWeeks waveId={typed.id} weeks={weeks} />
      </div>
    </DashboardShell>
  );
}
