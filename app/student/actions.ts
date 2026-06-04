"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStudentSession,
  validateStudentLoginFields,
} from "@/lib/auth/studentGate";
import { validateNewPassword } from "@/lib/auth/passwordReset";
import strings from "@/lib/strings";

export type StudentSignInState = { error?: string };
export type SetStudentPwState = { error?: string };

/**
 * signInStudent — member authentication with email + password.
 *
 * Mandatory fields → verify credentials → student-role gate. A member who has not
 * set a password fails the credential check (no password exists yet). An admin
 * token is denied (it is not a student session) and signed out in-request.
 */
export async function signInStudent(
  _prevState: StudentSignInState,
  formData: FormData
): Promise<StudentSignInState> {
  const emailRaw = formData.get("email");
  const password = formData.get("password");

  const fields = validateStudentLoginFields(emailRaw, password);
  if (!fields.ok) return { error: fields.error };

  const email = (emailRaw as string).trim().toLowerCase();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: password as string,
  });
  if (error || !data.session) {
    return { error: strings.studentAuthFailed };
  }

  if (!assertStudentSession(data.session).ok) {
    await supabase.auth.signOut();
    return { error: strings.studentAuthFailed };
  }

  redirect("/student/dashboard");
}

/** Clear the student session and return to the student sign-in page. */
export async function signOutStudent() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/student");
}

/**
 * confirmStudentInvite — verifies an onboarding/recovery link ON AN EXPLICIT CLICK.
 *
 * The token is single-use, so a passive GET must not consume it (inbox prefetch
 * would burn it). Only this POST verifies the OTP; any failure — or a non-student
 * (e.g. admin) session — lands on the invalid-link state. Mirrors the admin
 * confirm flow but stays on the /student surface.
 */
export async function confirmStudentInvite(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const typeRaw = formData.get("type");
  // Members onboard via the Magic Link template (type "email"/"magiclink"); invite
  // and recovery are accepted too. Anything else falls back to "email".
  const allowed = ["email", "magiclink", "invite", "recovery"] as const;
  type OtpType = (typeof allowed)[number];
  const type: OtpType =
    typeof typeRaw === "string" && (allowed as readonly string[]).includes(typeRaw)
      ? (typeRaw as OtpType)
      : "email";
  const supabase = await createClient();

  const reject = () => redirect("/student/set-password?error=link");

  if (typeof tokenHash !== "string" || !tokenHash) return reject();

  // The OTP is single-use. If the Continue form is submitted more than once
  // (double-click, browser back-then-resubmit), the FIRST verify already
  // established a valid session and the SECOND fails with otp_expired. Decide on
  // the resulting SESSION rather than this call's error: only reject when there
  // is no valid student session to fall back on.
  await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertStudentSession(user ? { user } : null).ok) {
    if (user) await supabase.auth.signOut();
    return reject();
  }

  redirect("/student/set-password");
}

/**
 * setStudentPassword — applies a new password from a valid member invite/recovery
 * session, then marks the member active so they can sign in.
 */
export async function setStudentPassword(
  _prevState: SetStudentPwState,
  formData: FormData
): Promise<SetStudentPwState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertStudentSession(user ? { user } : null).ok) {
    return { error: strings.studentResetLinkInvalid };
  }

  const valid = validateNewPassword(formData.get("password"), formData.get("confirm"));
  if (!valid.ok) return { error: valid.error };

  const { error } = await supabase.auth.updateUser({
    password: formData.get("password") as string,
  });
  if (error) return { error: strings.studentResetLinkInvalid };

  // The member has set their first password → active and able to sign in (FR-018).
  // Written with the service-role client because RLS does not let a student UPDATE
  // their own students row; scoped to their own user_id, after the session gate.
  const admin = createAdminClient();
  await admin.from("students").update({ status: "active" }).eq("user_id", user!.id);

  redirect("/student/dashboard");
}
