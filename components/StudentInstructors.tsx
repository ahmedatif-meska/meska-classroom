import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { instructorImageUrl } from "@/lib/instructors/image";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import strings from "@/lib/strings";

type InstructorRow = {
  id: string;
  name: string;
  description_html: string | null;
  image_path: string | null;
};

function Avatar({ row }: { row: InstructorRow }) {
  const url = instructorImageUrl(row.image_path);
  if (url) {
    return (
      <Image
        src={url}
        alt={row.name}
        width={56}
        height={56}
        loading="lazy"
        className="h-14 w-14 shrink-0 rounded-2xl object-cover"
      />
    );
  }
  const initial = (row.name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-xl font-bold text-brand"
    >
      {initial}
    </span>
  );
}

/**
 * Home "About instructors" section (Server Component). Shows the admin-managed
 * instructor directory to students — read-only. Instructors are global (no
 * tenant_id); a revised RLS policy (migration 0015) lets any authenticated user
 * SELECT them, while writes stay admin-only. Descriptions are sanitized before
 * render (defense-in-depth at the trust boundary).
 */
export default async function StudentInstructors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructors")
    .select("id, name, description_html, image_path")
    .order("created_at", { ascending: false });

  const instructors = (data ?? []) as InstructorRow[];

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-ink">
        {strings.studentInstructorsTitle}
      </h2>
      {instructors.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          {strings.studentInstructorsEmptyNote}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {instructors.map((row) => (
            <article
              key={row.id}
              className="flex gap-4 rounded-2xl border border-slate-200 bg-surface p-5"
            >
              <Avatar row={row} />
              <div className="min-w-0">
                <h3 className="font-bold text-ink">{row.name}</h3>
                {row.description_html ? (
                  <div
                    className="instructor-rte mt-1 text-sm text-slate-600"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeDescription(row.description_html),
                    }}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
