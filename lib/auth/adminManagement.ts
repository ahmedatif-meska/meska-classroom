import strings from "@/lib/strings";

/**
 * Pure helpers for the Admin Management feature. Kept free of Supabase/Next
 * imports so the guarantees (field validation, display-name fallback) are
 * deterministically unit-testable — mirrors lib/auth/adminGate.ts.
 */

type AdminNameRow = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email: string;
};

/**
 * The Name shown in the list. Prefers "First Last", then display_name, then the
 * email local-part — so existing rows and partial data never render blank.
 */
export function adminDisplayName(row: AdminNameRow): string {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;

  const display = row.display_name?.trim() ?? "";
  if (display) return display;

  const local = row.email.split("@")[0]?.trim();
  return local || row.email;
}

export type NewAdminValidation =
  | { ok: true; firstName: string; lastName: string; email: string }
  | { ok: false; error: string };

// Pragmatic email shape check — the same intent as the browser's type=email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * FR-007 / FR-018 — both names required (non-empty after trim) and a syntactically
 * valid email. On success returns the normalized values (trimmed names, trimmed +
 * lowercased email) so callers never re-normalize.
 */
export function validateNewAdminFields(
  firstName: FormDataEntryValue | null | undefined,
  lastName: FormDataEntryValue | null | undefined,
  email: FormDataEntryValue | null | undefined
): NewAdminValidation {
  const f = typeof firstName === "string" ? firstName.trim() : "";
  const l = typeof lastName === "string" ? lastName.trim() : "";
  if (!f || !l) return { ok: false, error: strings.adminMgmtNameRequired };

  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e || !EMAIL_RE.test(e)) {
    return { ok: false, error: strings.adminMgmtEmailInvalid };
  }

  return { ok: true, firstName: f, lastName: l, email: e };
}
