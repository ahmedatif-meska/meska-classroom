"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdminSession } from "@/lib/auth/adminGate";
import { validateMemberFields } from "@/lib/members/validation";
import { provisionMember, sendMemberMagicLink } from "@/lib/members/create";
import { parseAndValidateMembersCsv } from "@/lib/members/csv";
import { logError } from "@/lib/errors/log";
import { invalidate } from "@/lib/cache/redis";
import { adminListKey, studentKey } from "@/lib/cache/keys";
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
export type ReassignMembersState = {
  error?: string;
  reassignedCount?: number;
  failedCount?: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type MemberAuthReason =
  | "member_created"
  | "member_reinvited"
  | "member_removed"
  | "member_reassigned";

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
  await invalidate(adminListKey("members"));
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
  await invalidate(adminListKey("members"));
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
    .select("user_id, email, tenant_id")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return { error: strings.removeMemberFailed };

  const admin = createAdminClient();
  if (target.user_id) {
    // Deleting the auth user cascades to the students row (user_id FK on delete).
    const { error } = await admin.auth.admin.deleteUser(target.user_id);
    if (error) {
      await logError({
        operation: "removeMember",
        surface: "admin",
        error,
        context: { targetId, step: "deleteUser" },
      });
      return { error: strings.removeMemberFailed };
    }
  } else {
    const { error } = await admin.from("students").delete().eq("id", targetId);
    if (error) {
      await logError({
        operation: "removeMember",
        surface: "admin",
        error,
        context: { targetId, step: "studentsDelete" },
      });
      return { error: strings.removeMemberFailed };
    }
  }

  await logEvent(supabase, target.email ?? "", "success", "member_removed");
  revalidatePath(MEMBERS_PATH);
  await invalidate(adminListKey("members"));
  if (target.user_id && target.tenant_id) {
    await invalidate(studentKey(target.tenant_id, target.user_id, "profile"));
  }
  return { removed: true };
}

/**
 * reassignMembers — assign one or more UNASSIGNED members to a wave (gated).
 *
 * Admin-only → the wave must exist → each target is updated only while its
 * tenant_id is still null (`.is("tenant_id", null)` makes the update a compare-
 * and-set, so a member assigned meanwhile is never overwritten — wave isolation
 * is preserved under concurrent admins). After the row is claimed, the wave is
 * mirrored into the auth user's `app_metadata.tenant_id` (the JWT claim RLS
 * reads; same shape provisionMember sets at creation). If that claims write
 * fails the row is reverted to null so the member stays visibly unassigned and
 * the action can simply be retried. Ineligible (already assigned) or missing
 * ids are reported in failedCount, never silently reassigned.
 */
export async function reassignMembers(
  _prevState: ReassignMembersState,
  formData: FormData
): Promise<ReassignMembersState> {
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

  const memberIds = formData
    .getAll("member_ids")
    .filter((v): v is string => typeof v === "string" && Boolean(v));
  if (memberIds.length === 0) return { error: strings.reassignNoSelection };

  // The wave must exist BEFORE any claims write — app_metadata has no FK, so a
  // bogus id would otherwise be stamped into a member's JWT claims.
  const { data: wave } = await supabase
    .from("tenants")
    .select("id")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave) return { error: strings.reassignFailed };

  const { data: targets, error: targetsErr } = await supabase
    .from("students")
    .select("id, user_id, email, tenant_id")
    .in("id", memberIds);
  if (targetsErr || !targets) {
    await logError({
      operation: "reassignMembers",
      surface: "admin",
      error: targetsErr ?? "targets query returned no data",
      context: { waveId },
    });
    return { error: strings.reassignFailed };
  }

  const eligible = targets.filter((t) => t.tenant_id === null);
  let failedCount = memberIds.length - eligible.length;
  let reassignedCount = 0;

  const admin = createAdminClient();
  for (const target of eligible) {
    // Claim the row first (CAS on tenant_id null); only the winner proceeds to
    // touch the auth claims, so two admins can never split row vs claims.
    const { data: updated, error: rowErr } = await supabase
      .from("students")
      .update({ tenant_id: waveId })
      .eq("id", target.id)
      .is("tenant_id", null)
      .select("id");
    if (rowErr || !updated || updated.length === 0) {
      if (rowErr) {
        await logError({
          operation: "reassignMembers",
          surface: "admin",
          error: rowErr,
          context: { memberId: target.id, waveId, step: "studentsUpdate" },
        });
      }
      failedCount += 1;
      continue;
    }

    if (target.user_id) {
      const { error: claimsErr } = await admin.auth.admin.updateUserById(
        target.user_id,
        { app_metadata: { role: "student", tenant_id: waveId } }
      );
      if (claimsErr) {
        await logError({
          operation: "reassignMembers",
          surface: "admin",
          error: claimsErr,
          context: { memberId: target.id, waveId, step: "updateClaims" },
        });
        // Roll the row back so roster and claims never disagree; the member
        // remains unassigned and retryable.
        const { error: revertErr } = await supabase
          .from("students")
          .update({ tenant_id: null })
          .eq("id", target.id);
        if (revertErr) {
          await logError({
            operation: "reassignMembers",
            surface: "admin",
            error: revertErr,
            context: { memberId: target.id, waveId, step: "revertRow" },
          });
        }
        failedCount += 1;
        continue;
      }
    }

    reassignedCount += 1;
    await logEvent(supabase, target.email ?? "", "success", "member_reassigned");
    if (target.user_id) {
      // Drop any profile cached under the new wave for this user (defensive).
      await invalidate(studentKey(waveId, target.user_id, "profile"));
    }
  }

  revalidatePath(MEMBERS_PATH);
  if (reassignedCount > 0) await invalidate(adminListKey("members"));
  return { reassignedCount, failedCount };
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
    await invalidate(adminListKey("members"));
  }
  revalidatePath(MEMBERS_PATH);
  return { results, createdCount };
}
