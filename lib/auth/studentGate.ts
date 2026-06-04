import strings from "@/lib/strings";

/**
 * Pure authorization helpers for member (student) sessions. Kept free of
 * Supabase/Next imports so the guarantees (mandatory fields, student-only gate)
 * are deterministically unit-testable — mirrors `lib/auth/adminGate.ts`.
 */

export type FieldValidation = { ok: true } | { ok: false; error: string };

/** Both fields are mandatory, enforced server-side. */
export function validateStudentLoginFields(
  email: FormDataEntryValue | null | undefined,
  password: FormDataEntryValue | null | undefined
): FieldValidation {
  const e = typeof email === "string" ? email.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!e || !p) return { ok: false, error: strings.studentEmailRequired };
  return { ok: true };
}

type SessionLike = {
  user?: { app_metadata?: Record<string, unknown> | null } | null;
} | null;

export type StudentCheck = { ok: true } | { ok: false; reason: "not_student" };

/**
 * Only the student role passes. An admin token is NOT a student session — this
 * keeps members and admins on separate surfaces (the member-info page stays
 * admin-only; student routes stay member-only).
 */
export function assertStudentSession(session: SessionLike): StudentCheck {
  const role = session?.user?.app_metadata?.role;
  return role === "student" ? { ok: true } : { ok: false, reason: "not_student" };
}
