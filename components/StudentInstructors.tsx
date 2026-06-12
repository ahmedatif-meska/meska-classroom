import { createClient } from "@/lib/supabase/server";
import { instructorImageUrl } from "@/lib/instructors/image";
import StudentInstructorsList from "@/components/StudentInstructorsList";
import strings from "@/lib/strings";

type InstructorRow = {
  id: string;
  name: string;
  title: string | null;
  image_path: string | null;
};

/**
 * Home "About instructors" section (Server Component). Reads the admin-managed
 * instructor directory (read-only) and hands it to a Client list that shows two
 * rows with a "View All" toggle. Instructors are global (no tenant_id); a revised
 * RLS policy (migration 0015) lets any authenticated user SELECT them, while
 * writes stay admin-only.
 */
export default async function StudentInstructors() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructors")
    .select("id, name, title, image_path")
    .order("position", { ascending: true });

  const instructors = (data ?? []) as InstructorRow[];

  if (instructors.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">
          {strings.studentInstructorsTitle}
        </h2>
        <p className="text-sm text-slate-500">
          {strings.studentInstructorsEmptyNote}
        </p>
      </section>
    );
  }

  return (
    <StudentInstructorsList
      instructors={instructors.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        imageUrl: instructorImageUrl(row.image_path),
      }))}
    />
  );
}
