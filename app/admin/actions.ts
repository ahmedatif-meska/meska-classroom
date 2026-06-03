"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdminSession, validateLoginFields } from "@/lib/auth/adminGate";
import { validateEmailField, validateNewPassword } from "@/lib/auth/passwordReset";
import { validateNewAdminFields } from "@/lib/auth/adminManagement";
import strings from "@/lib/strings";

export type SignInState = { error?: string };
export type RequestResetState = { error?: string; sent?: boolean };
export type UpdatePasswordState = { error?: string };
export type CreateAdminState = {
  error?: string;
  created?: boolean;
  inviteFailed?: boolean;
};
export type ResendInviteState = { error?: string; sent?: boolean };
export type RemoveAdminState = { error?: string; removed?: boolean };

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AuthEventReason =
  | "ok"
  | "bad_credentials"
  | "not_admin"
  | "reset_requested"
  | "reset_done"
  | "reset_invalid"
  | "admin_created"
  | "admin_removed"
  | "admin_reinvited";

const ADMIN_LIST_PATH = "/admin/admins";

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
  const typeRaw = formData.get("type");
  // The same confirm flow serves recovery (003) and invite (004 — a new admin
  // setting their first password). Any other type is treated as an invalid link.
  const type = typeRaw === "invite" ? "invite" : "recovery";
  const supabase = await createClient();

  const reject = async (email: string) => {
    await logEvent(supabase, email, "denied", "reset_invalid");
    redirect("/admin/reset-password?error=link");
  };

  if (typeof tokenHash !== "string" || !tokenHash) return reject("");

  const { error } = await supabase.auth.verifyOtp({
    type,
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

  // An invited admin setting their first password becomes active (idempotent for
  // an already-active admin completing a normal recovery). FR-010 / SC-004.
  await supabase
    .from("admin_profiles")
    .update({ status: "active" })
    .eq("id", user!.id);

  await logEvent(supabase, user!.email ?? "", "success", "reset_done");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/admin");
}

/**
 * createAdmin — invite a new administrator (gated Server Action).
 *
 * Admin-only (assertAdminSession) → validate fields → reject a duplicate admin
 * email → create the auth user + send the magic-link invite (Supabase Admin API)
 * → set the immutable role claim → insert a `pending` admin_profiles row → audit.
 * The new admin sets their OWN password via the emailed link (FR-009/FR-010). If
 * the invite email could not be dispatched the account is still created `pending`
 * and the caller is told to re-send (FR-021).
 *
 * The service-role Admin API is reached only AFTER the admin gate passes, so the
 * privileged client never runs for a non-admin caller (Complexity Tracking).
 */
export async function createAdmin(
  _prevState: CreateAdminState,
  formData: FormData
): Promise<CreateAdminState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.adminMgmtForbidden };
  }

  const valid = validateNewAdminFields(
    formData.get("first_name"),
    formData.get("last_name"),
    formData.get("email")
  );
  if (!valid.ok) return { error: valid.error };
  const { firstName, lastName, email } = valid;

  const { data: isAdmin } = await supabase.rpc("is_admin_email", {
    p_email: email,
  });
  if (isAdmin) return { error: strings.adminMgmtEmailInUse };

  const admin = createAdminClient();
  const { data, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`,
      data: { first_name: firstName, last_name: lastName },
    }
  );

  const newUser = data?.user;
  if (!newUser) {
    // No user created — distinguish an already-registered email from a real failure.
    if (inviteErr && /already|exists|registered/i.test(inviteErr.message)) {
      return { error: strings.adminMgmtEmailInUse };
    }
    return { error: strings.adminMgmtInviteFailed };
  }

  // app_metadata is not an invite option, so set the role claim immediately after
  // (research R1 — the gap is sub-second and entirely before any email arrives).
  await admin.auth.admin.updateUserById(newUser.id, {
    app_metadata: { role: "admin" },
  });

  const { error: insertErr } = await admin.from("admin_profiles").insert({
    id: newUser.id,
    email,
    first_name: firstName,
    last_name: lastName,
    display_name: `${firstName} ${lastName}`,
    role: "admin",
    status: "pending",
  });
  if (insertErr) return { error: strings.adminMgmtEmailInUse };

  await logEvent(supabase, email, "success", "admin_created");
  revalidatePath(ADMIN_LIST_PATH);
  return { created: true, inviteFailed: Boolean(inviteErr) };
}

/**
 * resendInvite — re-send a set-password link to a still-pending admin (gated).
 *
 * The target already exists in auth.users (the original invite created it), so the
 * `inviteUserByEmail` primitive — which only CREATES users — cannot be reused. We
 * send a recovery link instead (`resetPasswordForEmail`), which mints a fresh
 * single-use token for the existing user and reuses the same `/admin/auth/confirm`
 * → set-password flow as 003. Admin-only; only offered for `pending` admins
 * (an active admin has no pending link). Audited as `admin_reinvited`
 * (FR-020/FR-021).
 */
export async function resendInvite(
  _prevState: ResendInviteState,
  formData: FormData
): Promise<ResendInviteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.adminMgmtForbidden };
  }

  const targetId = formData.get("target_id");
  if (typeof targetId !== "string" || !targetId) {
    return { error: strings.adminMgmtResendNotPending };
  }

  const { data: target } = await supabase
    .from("admin_profiles")
    .select("email, status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.status !== "pending") {
    return { error: strings.adminMgmtResendNotPending };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`,
  });
  if (error) return { error: strings.adminMgmtInviteFailed };

  await logEvent(supabase, target.email, "success", "admin_reinvited");
  revalidatePath(ADMIN_LIST_PATH);
  return { sent: true };
}

/**
 * removeAdmin — delete an administrator (gated Server Action).
 *
 * Admin-only → block self-removal → block removing the last ACTIVE admin (so the
 * platform always keeps one administrator who can sign in, FR-016) → delete the
 * auth user, which FK-cascades the admin_profiles row → audit (FR-014). The
 * active-count is read with the cookie/RLS client; only the delete uses the
 * service-role Admin API, and only after every guard passes.
 */
export async function removeAdmin(
  _prevState: RemoveAdminState,
  formData: FormData
): Promise<RemoveAdminState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.adminMgmtForbidden };
  }

  const targetId = formData.get("target_id");
  const targetEmail =
    typeof formData.get("target_email") === "string"
      ? (formData.get("target_email") as string)
      : "";
  if (typeof targetId !== "string" || !targetId) {
    return { error: strings.adminMgmtForbidden };
  }
  if (targetId === user!.id) return { error: strings.adminMgmtNoSelfRemove };

  // Last-active-admin guard (FR-016): read the active admins in one query so we
  // can see both whether the target is active and how many actives remain.
  const { data: actives } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("status", "active");
  const activeIds = (actives ?? []).map((r: { id: string }) => r.id);
  if (activeIds.includes(targetId) && activeIds.length <= 1) {
    return { error: strings.adminMgmtLastAdmin };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) return { error: strings.adminMgmtForbidden };

  await logEvent(supabase, targetEmail, "success", "admin_removed");
  revalidatePath(ADMIN_LIST_PATH);
  return { removed: true };
}
