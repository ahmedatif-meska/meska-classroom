import { createClient } from "@/lib/supabase/server";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { signedUrl, MATERIALS_BUCKET } from "@/lib/waves/files";
import SubmitAssignment from "@/components/SubmitAssignment";
import strings from "@/lib/strings";

export type Week = {
  id: string;
  title: string | null;
  position: number;
  description_html: string | null;
};
type Material = { id: string; title: string; file_path: string };
type Assignment = {
  id: string;
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

function DisclosureChevron() {
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
      className="shrink-0 transition-transform duration-200 group-open:rotate-180"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const SUMMARY_CLASS =
  "flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-6 py-4 text-base font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden";

/**
 * One week's student-facing content (Server Component): a **Resources** group
 * (the week's downloadable materials) and an **Assignments** group (downloads +
 * submit), each a labelled `<details>` disclosure. Everything is wave-scoped by
 * RLS and additionally filtered to this week; a student never sees another wave's
 * content (Principle VI). Materials/assignment files download via short-lived
 * signed URLs that only issue for the caller's own wave (else null).
 */
export default async function StudentWeekContent({
  tenantId,
  week,
  studentId,
}: {
  tenantId: string;
  week: Week;
  studentId: string;
}) {
  const supabase = await createClient();

  const [{ data: matData }, { data: asgData }, { data: subData }] =
    await Promise.all([
      supabase
        .from("wave_materials")
        .select("id, title, file_path")
        .eq("tenant_id", tenantId)
        .eq("week_id", week.id),
      supabase
        .from("wave_assignments")
        .select("id, title, file_path, instructions_html, due_at")
        .eq("tenant_id", tenantId)
        .eq("week_id", week.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("wave_submissions")
        .select("assignment_id")
        .eq("student_id", studentId),
    ]);

  const materials = (matData ?? []) as Material[];
  const assignments = (asgData ?? []) as Assignment[];
  const submittedIds = new Set(
    (subData ?? []).map((s) => s.assignment_id as string)
  );

  // Pre-sign every file URL (own wave → policy passes; otherwise null).
  const matUrls = new Map<string, string | null>();
  const asgUrls = new Map<string, string | null>();
  await Promise.all([
    ...materials.map(async (m) => {
      matUrls.set(m.id, await signedUrl(supabase, MATERIALS_BUCKET, m.file_path));
    }),
    ...assignments.map(async (a) => {
      asgUrls.set(a.id, await signedUrl(supabase, MATERIALS_BUCKET, a.file_path));
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">
        {week.title || `${strings.weekDefaultTitle} ${week.position}`}
      </h1>
      {week.description_html ? <RenderedHtml html={week.description_html} /> : null}

      <div className="mt-8 flex flex-col gap-4">
        {/* Resources (materials) */}
        <details
          className="group rounded-2xl border border-slate-200 bg-surface"
          open
        >
          <summary className={SUMMARY_CLASS}>
            {strings.studentResourcesLabel}
            <DisclosureChevron />
          </summary>
          <div className="border-t border-slate-100 px-6 py-4">
            {materials.length === 0 ? (
              <p className="text-sm text-slate-500">
                {strings.studentWeekNoMaterials}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {materials.map((m) => {
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
                        <span className="text-sm text-slate-400">{m.title}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </details>

        {/* Assignments */}
        <details
          className="group rounded-2xl border border-slate-200 bg-surface"
          open
        >
          <summary className={SUMMARY_CLASS}>
            {strings.studentAssignmentsLabel}
            <DisclosureChevron />
          </summary>
          <div className="border-t border-slate-100 px-6 py-4">
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500">
                {strings.studentWeekNoAssignments}
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {assignments.map((a) => {
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
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
