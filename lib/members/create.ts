import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import strings from "@/lib/strings";

/**
 * Shared member-provisioning helper used by both the single-add (`createMember`)
 * and bulk (`bulkCreateMembers`) Server Actions. It runs on the **service-role
 * Admin API** (the only client able to create an `auth.users` row) and is therefore
 * only ever called AFTER the caller's admin session has been asserted.
 *
 * Members are onboarded via Supabase's **Magic Link** email template (separate from
 * the admin **Invite** template, which 004 owns): create the auth user with the
 * immutable claims `{ role:'student', tenant_id:<wave> }`, insert the `pending`
 * students row, then send a magic link (→ `/student/auth/confirm` → set password).
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type ProvisionInput = {
  fullName: string;
  email: string; // already trimmed + lowercased
  whatsapp: string;
  waveId: string;
};

export type ProvisionResult =
  | { ok: true; inviteFailed: boolean }
  | { ok: false; error: string };

/**
 * Sends the member onboarding **Magic Link** email (Supabase "Magic Link" template)
 * via an isolated anon client so the admin caller's session is never touched.
 * Returns true when delivery FAILED (so the caller can surface a re-send).
 */
export async function sendMemberMagicLink(email: string): Promise<boolean> {
  const anon = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/student/auth/confirm`,
    },
  });
  return Boolean(error);
}

export async function provisionMember(
  admin: AdminClient,
  input: ProvisionInput
): Promise<ProvisionResult> {
  const { fullName, email, whatsapp, waveId } = input;

  // Create the auth user with the immutable claims set up-front (no email is sent
  // by createUser; the onboarding magic link is sent separately below).
  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, whatsapp },
    app_metadata: { role: "student", tenant_id: waveId },
  });

  const newUser = data?.user;
  if (!newUser) {
    if (createErr && /already|exists|registered/i.test(createErr.message)) {
      return { ok: false, error: strings.memberMgmtEmailInUse };
    }
    return { ok: false, error: strings.memberMgmtInviteFailed };
  }

  const { error: insertErr } = await admin.from("students").insert({
    user_id: newUser.id,
    email,
    whatsapp,
    full_name: fullName,
    tenant_id: waveId,
    student_code: email, // satisfies the legacy NOT NULL / unique(tenant_id, student_code)
    status: "pending",
  });
  if (insertErr) return { ok: false, error: strings.memberMgmtEmailInUse };

  const inviteFailed = await sendMemberMagicLink(email);
  return { ok: true, inviteFailed };
}
