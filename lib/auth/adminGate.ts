import strings from "@/lib/strings";

/**
 * Pure authorization helpers for admin sign-in. Kept free of Supabase/Next
 * imports so the guarantees (admin-only gate, mandatory fields, generic failure)
 * are deterministically unit-testable.
 */

export type FieldValidation = { ok: true } | { ok: false; error: string };

/** FR-002 / SC-003 — both fields are mandatory, enforced server-side. */
export function validateLoginFields(
  email: FormDataEntryValue | null | undefined,
  password: FormDataEntryValue | null | undefined
): FieldValidation {
  const e = typeof email === "string" ? email.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!e || !p) return { ok: false, error: strings.adminEmailRequired };
  return { ok: true };
}

type SessionLike = {
  user?: { app_metadata?: Record<string, unknown> | null } | null;
} | null;

export type AdminCheck = { ok: true } | { ok: false; reason: "not_admin" };

/**
 * FR-003 — only the administrator role passes. The caller maps a failed check to
 * the single generic message (FR-004 / SC-006) so denial reasons never leak.
 */
export function assertAdminSession(session: SessionLike): AdminCheck {
  const role = session?.user?.app_metadata?.role;
  return role === "admin" ? { ok: true } : { ok: false, reason: "not_admin" };
}
