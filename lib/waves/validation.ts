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
