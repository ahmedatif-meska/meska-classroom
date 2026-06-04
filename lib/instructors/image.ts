/**
 * Public URL for an instructor photo stored in the public `instructor-images`
 * bucket. Client-safe (uses the NEXT_PUBLIC project URL). Returns null when there
 * is no image. Used by the list (RSC) and the form preview (client).
 */
export function instructorImageUrl(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/instructor-images/${path}`;
}
