import strings from "@/lib/strings";

/**
 * Pure validation helpers for member provisioning. Kept free of Supabase/Next
 * imports so the guarantees (required, trimmed, non-blank fields; valid email;
 * a wave selection) are deterministically unit-testable — mirrors
 * `lib/auth/adminManagement.ts`.
 */

export type MemberFieldValidation =
  | { ok: true; fullName: string; whatsapp: string; email: string; waveId: string }
  | { ok: false; error: string };

// Pragmatic email shape check — same intent as the browser's type=email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * FR-008 — full name, WhatsApp, and email are required (non-empty after trim),
 * the email must be syntactically valid, and a wave must be chosen. On success
 * returns the normalized values (trimmed fields, trimmed + lowercased email) so
 * callers never re-normalize.
 */
export function validateMemberFields(
  fullName: FormDataEntryValue | null | undefined,
  whatsapp: FormDataEntryValue | null | undefined,
  email: FormDataEntryValue | null | undefined,
  waveId: FormDataEntryValue | null | undefined
): MemberFieldValidation {
  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (!name) return { ok: false, error: strings.memberMgmtNameRequired };

  const wa = typeof whatsapp === "string" ? whatsapp.trim() : "";
  if (!wa) return { ok: false, error: strings.memberMgmtWhatsappRequired };

  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e || !isValidEmail(e)) {
    return { ok: false, error: strings.memberMgmtEmailInvalid };
  }

  const wave = typeof waveId === "string" ? waveId.trim() : "";
  if (!wave) return { ok: false, error: strings.memberMgmtWaveRequired };

  return { ok: true, fullName: name, whatsapp: wa, email: e, waveId: wave };
}
