"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdminSession } from "@/lib/auth/adminGate";
import { validateMemberFields } from "@/lib/members/validation";
import { provisionMember, sendMemberMagicLink } from "@/lib/members/create";
import { parseAndValidateMembersCsv } from "@/lib/members/csv";
import strings from "@/lib/strings";

export type CreateMemberState = {
  error?: string;
  created?: boolean;
  inviteFailed?: boolean;
};
export type ResendMemberState = { error?: string; sent?: boolean };
export type RemoveMemberState = { error?: string; removed?: boolean };
export type BulkResultRow = {
  row: number;
  email: string;
  created: boolean;
  reason?: string;
};
export type BulkCreateState = {
  error?: string;
  results?: BulkResultRow[];
  createdCount?: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type MemberAuthReason = "member_created" | "member_reinvited" | "member_removed";

const MEMBERS_PATH = "/admin/members";

/** Best-effort audit; never blocks the request and never surfaces to the client. */
async function logEvent(
  supabase: SupabaseServerClient,
  email: string,
  outcome: "success" | "denied",
  reason: MemberAuthReason
) {
  await supabase.rpc("log_admin_auth_event", {
    p_email: email,
    p_outcome: outcome,
    p_reason: reason,
  });
}

/**
 * createMember — provision a single member (gated Server Action).
 *
 * Admin-only (assertAdminSession) → validate fields → reject a duplicate member
 * email → provisionMember (service-role invite + claims + pending insert) → audit.
 * The Admin API runs only inside provisionMember, after the gate.
 */
export async function createMember(
  _prevState: CreateMemberState,
  formData: FormData
): Promise<CreateMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.memberMgmtForbidden };
  }

  const valid = validateMemberFields(
    formData.get("full_name"),
    formData.get("whatsapp"),
    formData.get("email"),
    formData.get("wave_id")
  );
  if (!valid.ok) return { error: valid.error };
  const { fullName, whatsapp, email, waveId } = valid;

  const { data: existing } = await supabase
    .from("students")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { error: strings.memberMgmtEmailInUse };

  const admin = createAdminClient();
  const result = await provisionMember(admin, { fullName, email, whatsapp, waveId });
  if (!result.ok) return { error: result.error };

  await logEvent(supabase, email, "success", "member_created");
  revalidatePath(MEMBERS_PATH);
  return { created: true, inviteFailed: result.inviteFailed };
}

/**
 * resendMemberInvite — re-send a set-password link to a still-pending member.
 *
 * Admin-only → pending-only target → sendMemberMagicLink (fresh single-use Magic
 * Link, same /student/auth/confirm flow) → audit member_reinvited (FR-026).
 */
export async function resendMemberInvite(
  _prevState: ResendMemberState,
  formData: FormData
): Promise<ResendMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.memberMgmtForbidden };
  }

  const targetId = formData.get("target_id");
  if (typeof targetId !== "string" || !targetId) {
    return { error: strings.memberMgmtResendNotPending };
  }

  const { data: target } = await supabase
    .from("students")
    .select("email, status")
    .eq("id", targetId)
    .maybeSingle();
  if (!target || target.status !== "pending" || !target.email) {
    return { error: strings.memberMgmtResendNotPending };
  }

  const failed = await sendMemberMagicLink(target.email);
  if (failed) return { error: strings.memberMgmtInviteFailed };

  await logEvent(supabase, target.email, "success", "member_reinvited");
  revalidatePath(MEMBERS_PATH);
  return { sent: true };
}

/**
 * removeMember — permanently delete a member (gated Server Action).
 *
 * Admin-only → resolve the target students row (its `user_id` + email) → delete the
 * auth user via the service-role Admin API, which FK-cascades the students row →
 * audit member_removed. If the row predates auth provisioning (no user_id), the
 * students row is deleted directly. The Admin API runs only after the gate.
 */
export async function removeMember(
  _prevState: RemoveMemberState,
  formData: FormData
): Promise<RemoveMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.memberMgmtForbidden };
  }

  const targetId = formData.get("target_id");
  if (typeof targetId !== "string" || !targetId) {
    return { error: strings.removeMemberFailed };
  }

  const { data: target } = await supabase
    .from("students")
    .select("user_id, email")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { error: strings.removeMemberFailed };

  const admin = createAdminClient();
  if (target.user_id) {
    // Deleting the auth user cascades to the students row (user_id FK on delete).
    const { error } = await admin.auth.admin.deleteUser(target.user_id);
    if (error) return { error: strings.removeMemberFailed };
  } else {
    const { error } = await admin.from("students").delete().eq("id", targetId);
    if (error) return { error: strings.removeMemberFailed };
  }

  await logEvent(supabase, target.email ?? "", "success", "member_removed");
  revalidatePath(MEMBERS_PATH);
  return { removed: true };
}

/**
 * bulkCreateMembers — provision many members from an uploaded CSV (gated).
 *
 * Admin-only → re-parse + validate the CSV SERVER-SIDE (the trust boundary): any
 * blank/whitespace cell, malformed email, wrong columns, or empty file rejects the
 * WHOLE file and creates nothing (FR-012). Otherwise each row is provisioned into
 * the confirmed wave; existing-member and in-file duplicate emails are skipped and
 * reported (FR-015).
 */
export async function bulkCreateMembers(
  _prevState: BulkCreateState,
  formData: FormData
): Promise<BulkCreateState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.memberMgmtForbidden };
  }

  const waveId = formData.get("wave_id");
  if (typeof waveId !== "string" || !waveId) {
    return { error: strings.memberMgmtWaveRequired };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: strings.bulkInvalidCsv };
  const text = await file.text();

  const parsed = parseAndValidateMembersCsv(text);
  if (!parsed.ok) {
    const rows = parsed.badRows?.length ? ` ${parsed.badRows.join(", ")}` : "";
    return { error: `${parsed.error}${rows}` };
  }

  const admin = createAdminClient();
  const results: BulkResultRow[] = [];
  const seen = new Set<string>();
  let createdCount = 0;

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const rowNum = i + 2; // CSV row number (header is line 1)
    const email = r.email.toLowerCase();

    if (seen.has(email)) {
      results.push({ row: rowNum, email, created: false, reason: strings.bulkSkippedLabel });
      continue;
    }
    seen.add(email);

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      results.push({ row: rowNum, email, created: false, reason: strings.bulkSkippedLabel });
      continue;
    }

    const res = await provisionMember(admin, {
      fullName: r.fullName,
      email,
      whatsapp: r.whatsapp,
      waveId,
    });
    if (res.ok) {
      createdCount += 1;
      results.push({ row: rowNum, email, created: true });
    } else {
      results.push({ row: rowNum, email, created: false, reason: res.error });
    }
  }

  if (createdCount > 0) {
    await logEvent(supabase, "", "success", "member_created");
  }
  revalidatePath(MEMBERS_PATH);
  return { results, createdCount };
}
