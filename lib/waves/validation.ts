import strings from "@/lib/strings";

/**
 * Pure validation helpers for the Waves feature. Kept free of Supabase/Next
 * imports so the guarantees (required name + type, allowed file type/size) are
 * deterministically unit-testable and run identically on the client (pre-check)
 * and the server (authoritative check). Mirrors `lib/instructors/validation.ts`.
 */

export type WaveType = "online" | "offline";

export type WaveFieldValidation =
  | { ok: true; name: string; type: WaveType }
  | { ok: false; error: string };

export type FileValidation = { ok: true } | { ok: false; error: string };

export const WAVE_TYPES = ["online", "offline"] as const;

/** A wave needs a non-empty name and a type of exactly online|offline (FR-003/FR-004). */
export function validateWaveFields(
  name: FormDataEntryValue | null | undefined,
  type: FormDataEntryValue | null | undefined
): WaveFieldValidation {
  const n = typeof name === "string" ? name.trim() : "";
  if (!n) return { ok: false, error: strings.wavesNameRequired };
  const t = typeof type === "string" ? type : "";
  if (!(WAVE_TYPES as readonly string[]).includes(t)) {
    return { ok: false, error: strings.wavesTypeRequired };
  }
  return { ok: true, name: n, type: t as WaveType };
}

/** Shared upload ceiling: 25 MB (FR-011/FR-012, Principle V). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Materials accept PDF + PowerPoint (FR-011). */
export const ALLOWED_MATERIAL_TYPES = [
  "application/pdf",
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
] as const;

/** Submissions accept the material set plus Word (FR-012a). */
export const ALLOWED_SUBMISSION_TYPES = [
  ...ALLOWED_MATERIAL_TYPES,
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
] as const;

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/** File extension for a supported MIME type (for the stored object path). */
export function extensionForType(type: string): string {
  return EXTENSIONS[type] ?? "bin";
}

function validateFile(
  file: { type: string; size: number } | null | undefined,
  allowed: readonly string[],
  error: string
): FileValidation {
  if (!file) return { ok: false, error };
  const typeOk = allowed.includes(file.type);
  const sizeOk = file.size > 0 && file.size <= MAX_FILE_BYTES;
  if (!typeOk || !sizeOk) return { ok: false, error };
  return { ok: true };
}

/** A material upload MUST be a PDF/PPT/PPTX within the size limit (FR-011). */
export function validateMaterialFile(
  file: { type: string; size: number } | null | undefined
): FileValidation {
  return validateFile(file, ALLOWED_MATERIAL_TYPES, strings.wavesMaterialInvalid);
}

/** A submission upload MUST be a PDF/PPT/PPTX/DOC/DOCX within the size limit (FR-012a). */
export function validateSubmissionFile(
  file: { type: string; size: number } | null | undefined
): FileValidation {
  return validateFile(
    file,
    ALLOWED_SUBMISSION_TYPES,
    strings.studentSubmissionInvalid
  );
}

/** Allowed object-name extensions, derived from the MIME allowlists. */
export const MATERIAL_EXTENSIONS = ALLOWED_MATERIAL_TYPES.map(
  (t) => EXTENSIONS[t]
);
export const SUBMISSION_EXTENSIONS = ALLOWED_SUBMISSION_TYPES.map(
  (t) => EXTENSIONS[t]
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Validates a client-supplied storage object path for a material or an
 * admin-uploaded assignment file. Files upload straight from the browser to
 * Storage (Server Action request bodies are capped at ~4.5 MB on Vercel), so
 * the action only receives this path and MUST verify it before recording it:
 * exactly `‹waveId›/‹weekId›/(assignment-)‹uuid›.‹ext›` — wave id first
 * (isolation invariant), a UUID object name, and an allowed extension.
 */
export function isMaterialObjectPath(
  path: string,
  waveId: string,
  weekId: string,
  kind: "material" | "assignment"
): boolean {
  if (!waveId || !weekId) return false;
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== waveId || parts[1] !== weekId) {
    return false;
  }
  const prefix = kind === "assignment" ? "assignment-" : "";
  if (!parts[2].startsWith(prefix)) return false;
  const name = parts[2].slice(prefix.length);
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return (
    UUID_RE.test(name.slice(0, dot)) &&
    MATERIAL_EXTENSIONS.includes(name.slice(dot + 1))
  );
}
