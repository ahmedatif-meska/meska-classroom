/**
 * Storage helpers for the Waves feature. The path builders enforce the
 * file-level wave-isolation invariant: the FIRST path segment is ALWAYS the wave
 * (tenant) id, so the Storage RLS predicate
 * `(storage.foldername(name))[1] = jwt_tenant_id()::text` is the file equivalent
 * of the row-level `tenant_id = jwt_tenant_id()` (constitution Principle VI).
 *
 * The path builders are pure (unit-tested); `signedUrl` is a thin wrapper over a
 * passed-in Supabase client so it stays server-only at the call site.
 */

export const MATERIALS_BUCKET = "wave-materials";
export const SUBMISSIONS_BUCKET = "assignment-submissions";

/** Signed-URL lifetime — short, so a leaked link expires quickly. */
export const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes

/** `‹wave_id›/‹week_id›/‹uuid›.‹ext›` — wave id first (isolation invariant). */
export function materialPath(
  waveId: string,
  weekId: string,
  id: string,
  ext: string
): string {
  return `${waveId}/${weekId}/${id}.${ext}`;
}

/**
 * Admin-uploaded assignment files live in the SAME private wave-materials bucket
 * (so the existing admin-write / student-read-by-wave-folder policies apply).
 * `‹wave_id›/‹week_id›/assignment-‹uuid›.‹ext›` — wave id first (isolation),
 * prefixed to keep them visually distinct from materials in the bucket.
 */
export function assignmentPath(
  waveId: string,
  weekId: string,
  id: string,
  ext: string
): string {
  return `${waveId}/${weekId}/assignment-${id}.${ext}`;
}

/**
 * `‹wave_id›/‹assignment_id›/‹student_id›/submission.‹ext›` — wave id first, and
 * the student id as the third segment so the Storage policy can confine a student
 * to their OWN submissions. Deterministic per (assignment, student) so a
 * re-upload overwrites the previous file (latest-wins, research R8).
 */
export function submissionPath(
  waveId: string,
  assignmentId: string,
  studentId: string,
  ext: string
): string {
  return `${waveId}/${assignmentId}/${studentId}/submission.${ext}`;
}

type StorageCapableClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  };
};

/**
 * Short-lived signed URL for a private-bucket object. Returns null on any error
 * or when the caller is not authorized by the Storage RLS `select` policy (so a
 * Wave-A caller asking for a Wave-B path simply gets null — never a usable link).
 */
export async function signedUrl(
  supabase: StorageCapableClient,
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
