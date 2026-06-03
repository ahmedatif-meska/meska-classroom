"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession, validateLoginFields } from "@/lib/auth/adminGate";
import { validateEmailField, validateNewPassword } from "@/lib/auth/passwordReset";
import strings from "@/lib/strings";

export type SignInState = { error?: string };
export type RequestResetState = { error?: string; sent?: boolean };
export type UpdatePasswordState = { error?: string };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AuthEventReason =
  | "ok"
  | "bad_credentials"
  | "not_admin"
  | "reset_requested"
  | "reset_done"
  | "reset_invalid";

/** Best-effort audit; never blocks the request and never surfaces to the client. */
async function logEvent(
  supabase: SupabaseServerClient,
  email: string,
  outcome: "success" | "denied",
  reason: AuthEventReason
) {
  await supabase.rpc("log_admin_auth_event", {
    p_email: email,
    p_outcome: outcome,
    p_reason: reason,
  });
}

/**
 * signInAdmin — admin-only authentication (Server Action).
 *
 * Mandatory fields → verify credentials → admin-role gate. Every denial branch
 * (empty fields handled separately; bad credentials; valid-but-not-admin) is
 * indistinguishable to the caller (FR-004 / SC-006). A non-admin never holds an
 * admin session: it is signed out in-request before returning (R5).
 */
export async function signInAdmin(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const emailRaw = formData.get("email");
  const password = formData.get("password");

  const fields = validateLoginFields(emailRaw, password);
  if (!fields.ok) return { error: fields.error };

  const email = (emailRaw as string).trim().toLowerCase();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: password as string,
  });

  if (error || !data.session) {
    await logEvent(supabase, email, "denied", "bad_credentials");
    return { error: strings.adminAuthFailed };
  }

  const check = assertAdminSession(data.session);
  if (!check.ok) {
    await supabase.auth.signOut();
    await logEvent(supabase, email, "denied", "not_admin");
    return { error: strings.adminAuthFailed };
  }

  await logEvent(supabase, email, "success", "ok");
  redirect("/admin/dashboard");
}

/** Clear the admin session and return to the sign-in page. */
export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin");
}

/**
 * requestPasswordReset — admin-only, non-enumerating password-recovery request.
 *
 * A reset link is issued only when the email belongs to an administrator
 * (`is_admin_email` gate, FR-003/FR-010), but every request returns the SAME
 * neutral confirmation so the response never reveals whether an admin account
 * exists (FR-004 / SC-002). The outcome is audited server-side only (FR-015).
 */
export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const emailRaw = formData.get("email");

  const fields = validateEmailField(emailRaw);
  if (!fields.ok) return { error: fields.error };

  const email = (emailRaw as string).trim().toLowerCase();
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_admin_email", {
    p_email: email,
  });

  if (isAdmin) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`,
    });
    await logEvent(supabase, email, "success", "reset_requested");
  } else {
    await logEvent(supabase, email, "denied", "reset_requested");
  }

  return { sent: true };
}

/**
 * confirmPasswordReset — verifies a recovery link ON AN EXPLICIT CLICK.
 *
 * The recovery token is single-use, so it must NOT be consumed by a passive GET:
 * email link-scanners and inbox preview prefetch would burn the token before the
 * admin ever clicks, surfacing a spurious "expired" state. The confirm page renders
 * an interstitial; only this action — triggered by the admin pressing "Continue" —
 * calls `verifyOtp`. Any failure (missing/expired/used/tampered token, or a non-admin
 * recovery session) lands on the invalid-link state and changes nothing
 * (FR-005/FR-009/FR-010); a `reset_invalid` row is audited server-side (FR-015).
 */
export async function confirmPasswordReset(formData: FormData): Promise<void> {
  const tokenHash = formData.get("token_hash");
  const supabase = await createClient();

  const reject = async (email: string) => {
    await logEvent(supabase, email, "denied", "reset_invalid");
    redirect("/admin/reset-password?error=link");
  };

  if (typeof tokenHash !== "string" || !tokenHash) return reject("");

  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  if (error) return reject("");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    await supabase.auth.signOut();
    return reject(user?.email ?? "");
  }

  redirect("/admin/reset-password");
}

/**
 * updateAdminPassword — applies a new password from a valid admin recovery session.
 *
 * Requires a recovery session that passes the admin gate (FR-010); validates the
 * new password + confirmation before any change (FR-007); on success rewrites the
 * credential and revokes ALL of the admin's sessions (FR-012 / SC-007) before
 * returning to sign-in (FR-013).
 */
export async function updateAdminPassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.resetLinkInvalid };
  }

  const valid = validateNewPassword(formData.get("password"), formData.get("confirm"));
  if (!valid.ok) return { error: valid.error };

  const { error } = await supabase.auth.updateUser({
    password: formData.get("password") as string,
  });
  if (error) {
    await logEvent(supabase, user!.email ?? "", "denied", "reset_invalid");
    return { error: strings.resetUpdateFailed };
  }

  await logEvent(supabase, user!.email ?? "", "success", "reset_done");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/admin");
}
