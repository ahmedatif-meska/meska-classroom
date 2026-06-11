/**
 * Pure helpers for the week-videos feature (011). Kept free of Supabase/Next
 * imports so the guarantees (a pasted link IS a Google Drive file, the embedded
 * player URL is one we control) are deterministically unit-testable and run
 * identically on the client (pre-check) and the server (authoritative check).
 * Mirrors `lib/members/scan.ts` and `lib/waves/validation.ts`.
 *
 * Videos are NOT uploaded to our Storage — the admin hosts the file on Google
 * Drive and shares a link. We extract and persist only the Drive FILE ID, then
 * build the embed/watch URLs ourselves at render, so an `iframe src` is never an
 * arbitrary, attacker-influenced string.
 */

/** Max length of an admin-entered video title (FR-003). */
export const MAX_VIDEO_TITLE_LEN = 200;

// A Drive file id is URL-safe base64-ish: letters, digits, hyphen, underscore.
// Real ids are ~28–44 chars; require ≥ 20 so a short non-id word can't pass.
const FILE_ID_RE = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Extract the Google Drive file id from a shared link, or `null` if the input is
 * not a recognizable Drive link / bare id. Recognized shapes:
 *   - https://drive.google.com/file/d/<ID>/view|preview|edit (any trailing)
 *   - https://drive.google.com/open?id=<ID>
 *   - https://drive.google.com/uc?id=<ID>&export=download
 *   - a bare <ID>
 */
export function parseDriveFileId(
  input: string | null | undefined
): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;

  // A bare id (no scheme/host) — accept only if it is a clean file id.
  if (!value.includes("/") && !value.includes("?") && !value.includes("=")) {
    return FILE_ID_RE.test(value) ? value : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // Only Google Drive is supported (v1). Lock the host so we never embed an
  // arbitrary origin.
  if (url.hostname !== "drive.google.com") return null;

  // /file/d/<ID>/...
  const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const candidate = pathMatch?.[1] ?? url.searchParams.get("id");
  if (!candidate) return null;

  return FILE_ID_RE.test(candidate) ? candidate : null;
}

/** Canonical inline-player (embed) URL for a stored file id. */
export function driveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Canonical open-in-Drive URL (the student's fallback link). */
export function driveWatchUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
