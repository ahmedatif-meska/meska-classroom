import { createClient } from "@/lib/supabase/server";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { signedUrl, MATERIALS_BUCKET } from "@/lib/waves/files";
import { driveEmbedUrl, driveWatchUrl } from "@/lib/waves/video";
import SubmitAssignment from "@/components/SubmitAssignment";
import WeekVideoPlayer from "@/components/WeekVideoPlayer";
import WeekFeedback from "@/components/WeekFeedback";
import strings from "@/lib/strings";

export type Week = {
  id: string;
  title: string | null;
  position: number;
  description_html: string | null;
};
type Material = { id: string; title: string; file_path: string };
type Video = { id: string; title: string; drive_file_id: string };
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
      className="instructor-rte text-sm text-slate-600"
      dangerouslySetInnerHTML={{ __html: sanitizeDescription(html) }}
    />
  );
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
      {children}
    </span>
  );
}

function VideoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

/**
 * One week's student-facing content (Server Component): a **Resources** card
 * (the week's downloadable materials), an **Assignments** card (downloads +
 * submit), and a **Give Feedback** card. Everything is wave-scoped by RLS and
 * additionally filtered to this week; a student never sees another wave's
 * content (Principle VI). Files download via short-lived signed URLs that only
 * issue for the caller's own wave (else null). The lesson-video frame is an
 * empty placeholder for now — a real player renders there once an admin uploads
 * a link (no persisted video field exists today).
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

  const [{ data: matData }, { data: asgData }, { data: subData }, { data: vidData }] =
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
      supabase
        .from("wave_videos")
        .select("id, title, drive_file_id")
        .eq("tenant_id", tenantId)
        .eq("week_id", week.id)
        .order("position", { ascending: true }),
    ]);

  const materials = (matData ?? []) as Material[];
  const assignments = (asgData ?? []) as Assignment[];
  const videos = (vidData ?? []) as Video[];
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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {week.title || `${strings.weekDefaultTitle} ${week.position}`}
        </h1>
        {week.description_html ? (
          <RenderedHtml html={week.description_html} />
        ) : null}
      </header>

      {/* Videos — Google Drive players (click-to-load). Above Resources. */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CardIcon>
            <VideoIcon />
          </CardIcon>
          <h2 className="text-lg font-bold text-ink">
            {strings.studentVideosLabel}
          </h2>
        </div>

        {videos.length === 0 ? (
          <p className="text-sm text-slate-500">{strings.studentWeekNoVideos}</p>
        ) : (
          <ul className="space-y-5">
            {videos.map((v) => (
              <li key={v.id}>
                <WeekVideoPlayer
                  title={v.title}
                  embedUrl={driveEmbedUrl(v.drive_file_id)}
                  watchUrl={driveWatchUrl(v.drive_file_id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Resources */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardIcon>
              <BookIcon />
            </CardIcon>
            <h2 className="text-lg font-bold text-ink">
              {strings.studentResourcesLabel}
            </h2>
          </div>
          {materials.length > 0 ? (
            <span className="rounded-md bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
              {materials.length} {strings.studentResourcesFilesLabel}
            </span>
          ) : null}
        </div>

        {materials.length === 0 ? (
          <p className="text-sm text-slate-500">
            {strings.studentWeekNoMaterials}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {materials.map((m) => {
              const url = matUrls.get(m.id);
              return (
                <li key={m.id}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-page p-3.5 text-slate-500 transition-colors hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <FileIcon />
                      <span className="flex-grow truncate text-sm font-semibold text-ink">
                        {m.title}
                      </span>
                      <span className="text-brand">
                        <DownloadIcon />
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-page p-3.5 text-slate-400">
                      <FileIcon />
                      <span className="flex-grow truncate text-sm font-semibold">
                        {m.title}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Assignments */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <CardIcon>
            <ClipboardIcon />
          </CardIcon>
          <h2 className="text-lg font-bold text-ink">
            {strings.studentAssignmentsLabel}
          </h2>
        </div>

        {assignments.length === 0 ? (
          <p className="text-sm text-slate-500">
            {strings.studentWeekNoAssignments}
          </p>
        ) : (
          <ul className="space-y-4">
            {assignments.map((a) => {
              const url = asgUrls.get(a.id);
              return (
                <li
                  key={a.id}
                  className="space-y-3 rounded-xl border border-brand/10 bg-brand/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-brand">
                        {a.title}
                      </h3>
                      {a.due_at ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {strings.studentDueLabel}:{" "}
                          {new Date(a.due_at).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${a.title} — ${strings.materialDownloadLabel}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-surface text-brand shadow-sm transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <DownloadIcon />
                      </a>
                    ) : null}
                  </div>
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
      </section>

      {/* Give Feedback (rating; UI-only) */}
      <WeekFeedback />
    </div>
  );
}
