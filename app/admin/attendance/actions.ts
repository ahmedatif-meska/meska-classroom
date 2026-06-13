"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import { attendanceDay } from "@/lib/attendance/day";
import { logError } from "@/lib/errors/log";
import strings from "@/lib/strings";

export type AttendanceState = {
  error?: string;
  marked?: boolean;
  alreadyAttended?: boolean;
};

export type ImportState = {
  error?: string;
  marked?: number;
  skipped?: { email: string; reason: "unmatched" | "already" }[];
};

const ATTENDANCE_PATH = "/admin/attendance";

/** Postgres unique-violation — a concurrent mark won the (student, day) slot. */
const UNIQUE_VIOLATION = "23505";

/**
 * markAttendance — record a scanned student as present for an OFFLINE wave's
 * week (US2). Admin-gated; enforces server-side (never just in the UI):
 *  - the selected wave is `type='offline'` (scan is offline-only, FR-015);
 *  - the scanned student belongs to the selected wave (FR-027);
 *  - the week belongs to the wave (defensive);
 *  - at most one attendance per student per business day across ALL waves
 *    (FR-028) — friendly pre-check + the `unique(student_id, attended_on)`
 *    constraint as the race-proof authority.
 */
export async function markAttendance(
  _prev: AttendanceState,
  formData: FormData
): Promise<AttendanceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.attendanceForbidden };
  }

  const studentId = formData.get("student_id");
  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  if (
    typeof studentId !== "string" ||
    !studentId ||
    typeof waveId !== "string" ||
    !waveId ||
    typeof weekId !== "string" ||
    !weekId
  ) {
    return { error: strings.attendanceFailed };
  }

  const { data: wave } = await supabase
    .from("tenants")
    .select("id, type")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave || wave.type !== "offline") {
    return { error: strings.attendanceWaveNotOffline };
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, tenant_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student) return { error: strings.attendanceFailed };
  if (student.tenant_id !== waveId) {
    return { error: strings.attendanceWrongWave };
  }

  const { data: week } = await supabase
    .from("wave_weeks")
    .select("id")
    .eq("id", weekId)
    .eq("tenant_id", waveId)
    .maybeSingle();
  if (!week) return { error: strings.attendanceFailed };

  const attendedOn = attendanceDay(new Date());

  const { data: existing } = await supabase
    .from("wave_attendance")
    .select("id")
    .eq("student_id", studentId)
    .eq("attended_on", attendedOn)
    .maybeSingle();
  if (existing) return { alreadyAttended: true };

  const { error } = await supabase.from("wave_attendance").insert({
    tenant_id: waveId,
    week_id: weekId,
    student_id: studentId,
    attended_on: attendedOn,
    method: "scan",
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { alreadyAttended: true };
    await logError({
      operation: "markAttendance",
      surface: "admin",
      error,
      context: { studentId, waveId, weekId },
    });
    return { error: strings.attendanceFailed };
  }

  revalidatePath(ATTENDANCE_PATH);
  return { marked: true };
}

/**
 * importOnlineAttendance — mark an ONLINE wave's attendees present from the
 * email-only CSV (US3). The file is parsed in the browser; this action receives
 * only the validated email array (research R4 — no file bytes). Each row is
 * processed independently: unmatched emails and members already marked today
 * are skipped AND reported, never aborting the batch (FR-016). A per-row
 * unique-violation (lost race with a concurrent scan) is reported as `already`.
 */
export async function importOnlineAttendance(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.attendanceForbidden };
  }

  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  const emailsRaw = formData.get("emails");
  if (
    typeof waveId !== "string" ||
    !waveId ||
    typeof weekId !== "string" ||
    !weekId ||
    typeof emailsRaw !== "string"
  ) {
    return { error: strings.attendanceFailed };
  }

  // Re-validate the client-parsed list: strings only, lowercased, deduped.
  let emails: string[];
  try {
    const parsed: unknown = JSON.parse(emailsRaw);
    if (!Array.isArray(parsed) || parsed.some((e) => typeof e !== "string")) {
      return { error: strings.attendanceFailed };
    }
    emails = [...new Set(parsed.map((e: string) => e.trim().toLowerCase()))].filter(
      Boolean
    );
  } catch {
    return { error: strings.attendanceFailed };
  }
  if (emails.length === 0) return { error: strings.attendanceCsvEmpty };

  const { data: wave } = await supabase
    .from("tenants")
    .select("id, type")
    .eq("id", waveId)
    .maybeSingle();
  if (!wave || wave.type !== "online") {
    return { error: strings.attendanceWaveNotOnline };
  }

  const { data: week } = await supabase
    .from("wave_weeks")
    .select("id")
    .eq("id", weekId)
    .eq("tenant_id", waveId)
    .maybeSingle();
  if (!week) return { error: strings.attendanceFailed };

  // Resolve members of THIS wave by email (RLS-admin read).
  const { data: students } = await supabase
    .from("students")
    .select("id, email")
    .eq("tenant_id", waveId)
    .in("email", emails);
  const idByEmail = new Map(
    (students ?? []).map((s: { id: string; email: string | null }) => [
      (s.email ?? "").toLowerCase(),
      s.id,
    ])
  );

  const attendedOn = attendanceDay(new Date());

  // Batch pre-check for already-marked-today members (the constraint remains
  // the race-proof authority per row).
  const ids = [...idByEmail.values()];
  const { data: existing } = ids.length
    ? await supabase
        .from("wave_attendance")
        .select("student_id")
        .in("student_id", ids)
        .eq("attended_on", attendedOn)
    : { data: [] };
  const alreadyToday = new Set(
    (existing ?? []).map((r: { student_id: string }) => r.student_id)
  );

  let marked = 0;
  const skipped: { email: string; reason: "unmatched" | "already" }[] = [];

  for (const email of emails) {
    const studentId = idByEmail.get(email);
    if (!studentId) {
      skipped.push({ email, reason: "unmatched" });
      continue;
    }
    if (alreadyToday.has(studentId)) {
      skipped.push({ email, reason: "already" });
      continue;
    }
    const { error } = await supabase.from("wave_attendance").insert({
      tenant_id: waveId,
      week_id: weekId,
      student_id: studentId,
      attended_on: attendedOn,
      method: "csv",
    });
    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        skipped.push({ email, reason: "already" });
        continue;
      }
      await logError({
        operation: "importOnlineAttendance",
        surface: "admin",
        error,
        context: { waveId, weekId, email },
      });
      return { error: strings.attendanceFailed };
    }
    marked++;
  }

  revalidatePath(ATTENDANCE_PATH);
  return { marked, skipped };
}
