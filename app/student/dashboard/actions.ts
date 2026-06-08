"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStudentSession } from "@/lib/auth/studentGate";
import {
  validateSubmissionFile,
  extensionForType,
} from "@/lib/waves/validation";
import { SUBMISSIONS_BUCKET, submissionPath } from "@/lib/waves/files";
import strings from "@/lib/strings";

export type SubmissionState = { error?: string; saved?: boolean };

/**
 * submitAssignment — a member uploads (or replaces) their submission for an
 * assignment in their OWN wave (FR-012a). Wave isolation is enforced twice: the
 * assignment is fetched under the student's RLS (so only own-wave assignments
 * resolve), and the Storage + table policies independently confine the write to
 * the student's wave + own student-id folder. Latest-wins via upsert (R8).
 */
export async function submitAssignment(
  _prev: SubmissionState,
  formData: FormData
): Promise<SubmissionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertStudentSession(user ? { user } : null).ok) {
    return { error: strings.studentForbidden };
  }

  const tenantId = (user!.app_metadata?.tenant_id as string | undefined) ?? "";
  if (!tenantId) return { error: strings.studentForbidden };

  const assignmentId = formData.get("assignment_id");
  if (typeof assignmentId !== "string" || !assignmentId) {
    return { error: strings.studentSubmissionFailed };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: strings.studentSubmissionInvalid };
  }
  const check = validateSubmissionFile({ type: file.type, size: file.size });
  if (!check.ok) return { error: check.error };

  // Resolve the caller's own student row (RLS lets a student read their own wave).
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!student) return { error: strings.studentForbidden };

  // Confirm the assignment is in the caller's wave (RLS returns own-wave only).
  const { data: assignment } = await supabase
    .from("wave_assignments")
    .select("id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return { error: strings.studentForbidden };

  const path = submissionPath(
    tenantId,
    assignmentId,
    student.id,
    extensionForType(file.type)
  );
  const { error: upErr } = await supabase.storage
    .from(SUBMISSIONS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) return { error: strings.studentSubmissionFailed };

  const { error } = await supabase.from("wave_submissions").upsert(
    {
      tenant_id: tenantId,
      assignment_id: assignmentId,
      student_id: student.id,
      file_path: path,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" }
  );
  if (error) return { error: strings.studentSubmissionFailed };

  revalidatePath("/student/dashboard");
  return { saved: true };
}
