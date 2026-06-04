import strings from "@/lib/strings";

/**
 * Pure validation helpers for the Instructors feature. Kept free of Supabase/Next
 * imports so the guarantees (required name, allowed image type/size) are
 * deterministically unit-testable. Mirrors `lib/auth/adminGate.ts`.
 */

export type FieldValidation =
  | { ok: true; name: string }
  | { ok: false; error: string };

export type ImageValidation = { ok: true } | { ok: false; error: string };

/** FR-010 — the instructor name is required, non-empty after trim. */
export function validateInstructorFields(
  name: FormDataEntryValue | null | undefined
): FieldValidation {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return { ok: false, error: strings.instructorsNameRequired };
  return { ok: true, name: n };
}

/** Supported upload types (FR-007). Used by the server action and the client pre-check. */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Maximum upload size: 5 MB (FR-007, Principle V). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * FR-007 — an uploaded image MUST be a supported type within the size limit.
 * Pure: takes only the file's `{ type, size }` so it runs identically on the
 * client (pre-check) and server (authoritative check).
 */
export function validateImageFile(
  file: { type: string; size: number } | null | undefined
): ImageValidation {
  if (!file) return { ok: true }; // no image is allowed; presence is optional
  const typeOk = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
  const sizeOk = file.size > 0 && file.size <= MAX_IMAGE_BYTES;
  if (!typeOk || !sizeOk) {
    return { ok: false, error: strings.instructorsImageInvalid };
  }
  return { ok: true };
}

/** File extension for a supported MIME type (for the stored object path). */
export function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg"; // image/jpeg
}
