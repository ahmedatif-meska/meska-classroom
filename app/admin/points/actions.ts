"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import { logError } from "@/lib/errors/log";
import strings from "@/lib/strings";

export type PointRuleState = { error?: string; saved?: boolean };

export type PointAction = "attendance" | "assignment" | "feedback";

const POINT_ACTIONS: readonly PointAction[] = [
  "attendance",
  "assignment",
  "feedback",
];

/**
 * updatePointRule — edit one row of the global points configuration (US4).
 * Admin-gated; the value must be a non-negative WHOLE number (FR-020/FR-021) —
 * anything else is rejected with the prior value untouched. Totals are derived
 * from these values on read, so a save retroactively recomputes every
 * student's total (FR-029) — hence the student-dashboard revalidation.
 */
export async function updatePointRule(
  _prev: PointRuleState,
  formData: FormData
): Promise<PointRuleState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.pointsForbidden };
  }

  const action = formData.get("action");
  if (
    typeof action !== "string" ||
    !POINT_ACTIONS.includes(action as PointAction)
  ) {
    return { error: strings.pointsInvalid };
  }

  const pointsRaw = formData.get("points");
  const trimmed = typeof pointsRaw === "string" ? pointsRaw.trim() : "";
  // Digits only — rejects blank, negative, fractional, and non-numeric input.
  const points = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (!Number.isInteger(points) || points < 0) {
    return { error: strings.pointsInvalid };
  }

  const { error } = await supabase
    .from("point_rules")
    .update({ points, updated_at: new Date().toISOString() })
    .eq("action", action);
  if (error) {
    await logError({
      operation: "updatePointRule",
      surface: "admin",
      error,
      context: { action, points },
    });
    return { error: strings.pointsSaveFailed };
  }

  revalidatePath("/admin/points");
  revalidatePath("/student/dashboard");
  return { saved: true };
}
