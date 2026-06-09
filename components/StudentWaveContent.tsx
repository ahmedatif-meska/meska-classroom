import { createClient } from "@/lib/supabase/server";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { signedUrl, MATERIALS_BUCKET } from "@/lib/waves/files";
import SubmitAssignment from "@/components/SubmitAssignment";
import strings from "@/lib/strings";

type Week = {
  id: string;
  title: string | null;
  position: number;
  description_html: string | null;
};
type Material = { id: string; week_id: string; title: string; file_path: string };
type Assignment = {
  id: string;
  week_id: string;
  title: string;
  file_path: string | null;
  instructions_html: string | null;
  due_at: string | null;
};

function RenderedHtml({ html }: { html: string }) {
  // Sanitize again on render as defense-in-depth (the trust boundary).
  return (
    <div
      className="instructor-rte mt-2 text-sm text-ink"
      dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
    />
  );
}

/**
 * Student-facing wave content (Server Component): the weeks of the caller's wave,
 * each week's downloadable materials (via short-lived signed URLs that only issue
 * for the caller's own wave) and assignments with an upload control. Everything is
 * wave-scoped by RLS; a student never sees another wave's content (Principle VI).
 */
export default async function StudentWaveContent({
  tenantId,
  studentId,
}: {
  tenantId: string;
  studentId: string;
}) {
  const supabase = await createClient();

  const [{ data: weekData }, { data: matData }, { data: asgData }, { data: subData }] =
    await Promise.all([
      supabase
        .from("wave_weeks")
        .select("id, title, position, description_html")
        .eq("tenant_id", tenantId)
        .order("position", { ascending: true }),
      supabase
        .from("wave_materials")
        .select("id, week_id, title, file_path")
        .eq("tenant_id", tenantId),
      supabase
        .from("wave_assignments")
        .select("id, week_id, title, file_path, instructions_html, due_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true }),
      supabase
        .from("wave_submissions")
        .select("assignment_id")
        .eq("student_id", studentId),
    ]);

  const weeks = (weekData ?? []) as Week[];
  const materials = (matData ?? []) as Material[];
  const assignments = (asgData ?? []) as Assignment[];
  const submittedIds = new Set(
    (subData ?? []).map((s) => s.assignment_id as string)
  );

  if (weeks.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">
        {strings.studentWaveNoContent}
      </p>
    );
  }

  // Pre-sign every material URL (own wave → policy passes; otherwise null).
  const matUrls = new Map<string, string | null>();
  await Promise.all(
    materials.map(async (m) => {
      matUrls.set(
        m.id,
        await signedUrl(supabase, MATERIALS_BUCKET, m.file_path)
      );
    })
  );

  // Assignment files live in the same materials bucket (admin-uploaded).
  const asgUrls = new Map<string, string | null>();
  await Promise.all(
    assignments.map(async (a) => {
      asgUrls.set(
        a.id,
        await signedUrl(supabase, MATERIALS_BUCKET, a.file_path)
      );
    })
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      {weeks.map((week) => {
        const weekMaterials = materials.filter((m) => m.week_id === week.id);
        const weekAssignments = assignments.filter(
          (a) => a.week_id === week.id
        );
        return (
          <section
            key={week.id}
            className="rounded-2xl border border-slate-200 bg-surface p-6"
          >
            <h3 className="text-base font-bold text-ink">
              {week.title || `${strings.weekDefaultTitle} ${week.position}`}
            </h3>
            {week.description_html ? (
              <RenderedHtml html={week.description_html} />
            ) : null}

            {weekMaterials.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentMaterialsLabel}
                </h4>
                <ul className="mt-2 flex flex-col gap-1">
                  {weekMaterials.map((m) => {
                    const url = matUrls.get(m.id);
                    return (
                      <li key={m.id}>
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            {m.title} — {strings.materialDownloadLabel}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">
                            {m.title}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {weekAssignments.length > 0 ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-slate-500">
                  {strings.studentAssignmentsLabel}
                </h4>
                <ul className="mt-2 flex flex-col gap-4">
                  {weekAssignments.map((a) => {
                    const url = asgUrls.get(a.id);
                    return (
                      <li
                        key={a.id}
                        className="rounded-xl border border-slate-100 bg-page p-4"
                      >
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            {a.title} — {strings.materialDownloadLabel}
                          </a>
                        ) : (
                          <p className="font-semibold text-ink">{a.title}</p>
                        )}
                        {a.due_at ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {strings.studentDueLabel}:{" "}
                            {new Date(a.due_at).toLocaleDateString()}
                          </p>
                        ) : null}
                        {a.instructions_html ? (
                          <RenderedHtml html={a.instructions_html} />
                        ) : null}
                        <SubmitAssignment
                          assignmentId={a.id}
                          hasSubmission={submittedIds.has(a.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
