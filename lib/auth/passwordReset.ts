import strings from "@/lib/strings";

/**
 * Pure validation helpers for the admin password-recovery flow. Kept free of
 * Supabase/Next imports so the guarantees (mandatory email, new-password rules)
 * are deterministically unit-testable — same discipline as `lib/auth/adminGate.ts`.
 */

export type FieldValidation = { ok: true } | { ok: false; error: string };

/** Minimum new-password length; keep in sync with the Supabase password policy. */
export const MIN_PASSWORD_LENGTH = 8;

/** FR-002 — the recovery request requires a non-empty email. */
export function validateEmailField(
  email: FormDataEntryValue | null | undefined
): FieldValidation {
  const e = typeof email === "string" ? email.trim() : "";
  if (!e) return { ok: false, error: strings.forgotEmailRequired };
  return { ok: true };
}

/**
 * FR-007 / SC-006 — the new password must be present, long enough, and match its
 * confirmation. Checked server-side before any credential change.
 */
export function validateNewPassword(
  password: FormDataEntryValue | null | undefined,
  confirm: FormDataEntryValue | null | undefined
): FieldValidation {
  const p = typeof password === "string" ? password : "";
  const c = typeof confirm === "string" ? confirm : "";
  if (!p || !c) return { ok: false, error: strings.resetPasswordTooShort };
  if (p.length < MIN_PASSWORD_LENGTH)
    return { ok: false, error: strings.resetPasswordTooShort };
  if (p !== c) return { ok: false, error: strings.resetPasswordMismatch };
  return { ok: true };
}
