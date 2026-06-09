import type { createClient } from "@/lib/supabase/server";
import { signedUrl, MATERIALS_BUCKET, SUBMISSIONS_BUCKET } from "@/lib/waves/files";

/**
 * Shared wave-content shapes + loader. The admin wave page (server) and the
 * in-page create builder (client, via the `getWaveContent` action) both render the
 * same weeks/materials/assignments tree, so the query + signed-URL assembly lives
 * here once. All access is RLS-bounded by the passed-in cookie client.
 */

/** A wave (tenant) row as edited by the basic-info form. */
export type WaveRow = {
  id: string;
  name: string;
  description_html: string | null;
  type: "online" | "offline";
  created_at: string;
};

export type AdminMaterial = { id: string; title: string; url: string | null };
export type AdminSubmission = { studentName: string; url: string | null };
export type AdminAssignment = {
  id: string;
  title: string;
  url: string | null;
  instructions_html: string | null;
  due_at: string | null;
  submissions: AdminSubmission[];
};
export type AdminWeek = {
  id: string;
  title: string | null;
  position: number;
  description_html: string | null;
  materials: AdminMaterial[];
  assignments: AdminAssignment[];
};

type Client = Awaited<ReturnType<typeof createClient>>;

type SubmissionRow = {
  assignment_id: string;
  file_path: string;
  student: { full_name: string | null } | { full_name: string | null }[] | null;
};

/** Load a wave's weeks (with materials + assignments + submissions) and signed URLs. */
export async function fetchWaveContent(
  supabase: Client,
  waveId: string
): Promise<AdminWeek[]> {
  const [{ data: weekData }, { data: matData }, { data: asgData }, { data: subData }] =
    await Promise.all([
      supabase
        .from("wave_weeks")
        .select("id, title, position, description_html")
        .eq("tenant_id", waveId)
        .order("position", { ascending: true }),
      supabase
        .from("wave_materials")
        .select("id, week_id, title, file_path")
        .eq("tenant_id", waveId),
      supabase
        .from("wave_assignments")
        .select("id, week_id, title, file_path, instructions_html, due_at")
        .eq("tenant_id", waveId)
        .order("created_at", { ascending: true }),
      supabase
        .from("wave_submissions")
        .select("assignment_id, file_path, student:students(full_name)")
        .eq("tenant_id", waveId),
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

  // Assignment files live in the same wave-materials bucket (admin-uploaded).
  const asgUrl = new Map<string, string | null>();
  await Promise.all(
    assignments.map(async (a) => {
      asgUrl.set(
        a.id,
        await signedUrl(supabase, MATERIALS_BUCKET, a.file_path)
      );
    })
  );

  const subByAssignment = new Map<string, AdminSubmission[]>();
  await Promise.all(
    submissions.map(async (s) => {
      const st = Array.isArray(s.student) ? s.student[0] : s.student;
      const url = await signedUrl(supabase, SUBMISSIONS_BUCKET, s.file_path);
      const list = subByAssignment.get(s.assignment_id) ?? [];
      list.push({ studentName: st?.full_name ?? "—", url });
      subByAssignment.set(s.assignment_id, list);
    })
  );

  return (weekData ?? []).map((w) => ({
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
          url: asgUrl.get(a.id) ?? null,
          instructions_html: a.instructions_html,
          due_at: a.due_at,
          submissions: subByAssignment.get(a.id) ?? [],
        })
      ),
  }));
}
