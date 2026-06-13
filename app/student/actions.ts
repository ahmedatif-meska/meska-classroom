"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertStudentSession,
  validateStudentLoginFields,
} from "@/lib/auth/studentGate";
import {
  validateEmailField,
  validateNewPassword,
} from "@/lib/auth/passwordReset";
import { logError } from "@/lib/errors/log";
import strings from "@/lib/strings";

export type StudentSignInState = { error?: string };
export type SetStudentPwState = { error?: string };
export type StudentRequestResetState = { error?: string; sent?: boolean };
export type FeedbackState = {
  error?: string;
  saved?: boolean;
  awardedPoints?: number;
};

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
 * requestStudentPasswordReset — member-only, non-enumerating recovery request.
 *
 * A reset link is issued only when the email belongs to a member (the
 * `is_student_email` gate — mirror of the admin `is_admin_email`, FR-003), but
 * every request returns the SAME neutral confirmation so the response never
 * reveals whether an account exists (FR-002 / SC-002). The emailed link lands on
 * the existing `/student/auth/confirm` interstitial, which already verifies
 * `recovery` tokens on an explicit click → `/student/set-password` (R1).
 */
export async function requestStudentPasswordReset(
  _prevState: StudentRequestResetState,
  formData: FormData
): Promise<StudentRequestResetState> {
  const emailRaw = formData.get("email");

  const fields = validateEmailField(emailRaw);
  if (!fields.ok) return { error: fields.error };

  const email = (emailRaw as string).trim().toLowerCase();
  const supabase = await createClient();

  const { data: isStudent } = await supabase.rpc("is_student_email", {
    p_email: email,
  });

  if (isStudent) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/student/auth/confirm`,
    });
  }

  return { sent: true };
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
  if (error) {
    await logError({ operation: "setStudentPassword", surface: "student", error });
    return { error: strings.studentResetLinkInvalid };
  }

  // Revoke the member's OTHER sessions so a stolen/old session dies with the
  // password (FR-005, feature 012). The CURRENT session is kept so the
  // dashboard redirect below still works (onboarding and recovery share it).
  await supabase.auth.signOut({ scope: "others" });

  // The member has set their first password → active and able to sign in (FR-018).
  // Written with the service-role client because RLS does not let a student UPDATE
  // their own students row; scoped to their own user_id, after the session gate.
  const admin = createAdminClient();
  await admin.from("students").update({ status: "active" }).eq("user_id", user!.id);

  redirect("/student/dashboard");
}

/** Parses an optional 1–5 star rating; anything else becomes null (bounded). */
function ratingFrom(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Comment length bound — long pastes are truncated, never rejected. */
const MAX_FEEDBACK_COMMENT_LEN = 2000;

/**
 * submitFeedback — persist a member's weekly feedback (US5) and report the
 * points it earned for the thank-you popup (FR-025).
 *
 * Wave isolation is enforced twice: the week is fetched under the student's
 * RLS WITH an explicit own-tenant filter (a foreign wave's week id resolves
 * nothing and is rejected — mirrors `submitAssignment`), and the table's RLS
 * independently confines the row to the caller's own wave + own student row.
 * Feedback is one-shot: one row per (week, student), and re-submission is
 * rejected (a row already exists), so the feedback points count exactly once.
 */
export async function submitFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertStudentSession(user ? { user } : null).ok) {
    return { error: strings.studentForbidden };
  }

  const tenantId = (user!.app_metadata?.tenant_id as string | undefined) ?? "";
  if (!tenantId) return { error: strings.studentForbidden };

  const weekId = formData.get("week_id");
  if (typeof weekId !== "string" || !weekId) {
    return { error: strings.studentFeedbackFailed };
  }

  // Resolve the caller's own student row (RLS lets a student read their own).
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!student) return { error: strings.studentForbidden };

  // The week MUST belong to the caller's own wave (Principle VI) — a foreign
  // week id can never be fed feedback points.
  const { data: week } = await supabase
    .from("wave_weeks")
    .select("id")
    .eq("id", weekId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!week) return { error: strings.studentForbidden };

  // Feedback is one-shot: if a row already exists for this (week, student),
  // reject the resubmission so the points are never earned twice (FR-023).
  const { data: existing } = await supabase
    .from("wave_feedback")
    .select("id")
    .eq("week_id", weekId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (existing) return { error: strings.studentFeedbackAlreadySubmitted };

  const commentRaw = formData.get("comment");
  const comment =
    typeof commentRaw === "string"
      ? commentRaw.trim().slice(0, MAX_FEEDBACK_COMMENT_LEN)
      : "";

  const { error } = await supabase.from("wave_feedback").insert({
    tenant_id: tenantId,
    week_id: weekId,
    student_id: student.id,
    session_rating: ratingFrom(formData.get("session_rating")),
    instructor_rating: ratingFrom(formData.get("instructor_rating")),
    comment: comment || null,
  });
  if (error) {
    // A concurrent submit can still lose the unique(week_id, student_id) race —
    // treat the duplicate as the same one-shot rejection, not a generic failure.
    const code = (error as { code?: string }).code;
    if (code === "23505") {
      return { error: strings.studentFeedbackAlreadySubmitted };
    }
    await logError({
      operation: "submitFeedback",
      surface: "student",
      error,
      context: { weekId },
    });
    return { error: strings.studentFeedbackFailed };
  }

  // The CURRENT feedback rule value — shown in the thank-you popup (FR-025).
  const { data: rule } = await supabase
    .from("point_rules")
    .select("points")
    .eq("action", "feedback")
    .maybeSingle();

  revalidatePath("/student/dashboard");
  return { saved: true, awardedPoints: rule?.points ?? 0 };
}
