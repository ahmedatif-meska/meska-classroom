"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import {
  validateWaveFields,
  isMaterialObjectPath,
  normalizeWaveStatus,
} from "@/lib/waves/validation";
import { parseDriveFileId, MAX_VIDEO_TITLE_LEN } from "@/lib/waves/video";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { MATERIALS_BUCKET, SUBMISSIONS_BUCKET } from "@/lib/waves/files";
import { logError } from "@/lib/errors/log";
import { invalidate } from "@/lib/cache/redis";
import { adminListKey, studentKey } from "@/lib/cache/keys";
import { type WaveRow } from "@/lib/waves/content";
import strings from "@/lib/strings";

export type WaveFormState = { error?: string; saved?: boolean; wave?: WaveRow };
export type RemoveWaveState = { error?: string; removed?: boolean };
export type WeekState = { error?: string; saved?: boolean; id?: string };
export type MaterialState = { error?: string; saved?: boolean };
export type AssignmentState = { error?: string; saved?: boolean };
export type VideoState = { error?: string; saved?: boolean };

const LIST_PATH = "/admin/waves";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Admin gate shared by every action; returns the client + user, or null on denial. */
async function adminClient(): Promise<{
  supabase: SupabaseServerClient;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) return null;
  return { supabase };
}

function wavePath(id: string) {
  return `${LIST_PATH}/${id}`;
}

/** Best-effort removal of storage objects — never fails the calling action (R11). */
async function removeObjects(
  supabase: SupabaseServerClient,
  bucket: string,
  paths: (string | null | undefined)[]
): Promise<void> {
  const clean = paths.filter((p): p is string => Boolean(p));
  if (clean.length === 0) return;
  try {
    await supabase.storage.from(bucket).remove(clean);
  } catch {
    /* an orphaned object is harmless */
  }
}

// ---------------------------------------------------------------------------
// Wave (tenant) — create / update / delete
// ---------------------------------------------------------------------------

export async function createWave(
  _prev: WaveFormState,
  formData: FormData
): Promise<WaveFormState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const valid = validateWaveFields(formData.get("name"), formData.get("type"));
  if (!valid.ok) return { error: valid.error };

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      name: valid.name,
      type: valid.type,
      status: normalizeWaveStatus(formData.get("status")),
      description_html:
        sanitizeDescription(formData.get("description_html")) || null,
    })
    .select("id, name, description_html, type, status, created_at")
    .single();
  if (error || !data) {
    await logError({
      operation: "createWave",
      surface: "admin",
      error: error ?? "insert returned no row",
    });
    return { error: strings.wavesSaveFailed };
  }

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("waves"));
  // Return the new row so the create page can reveal its content builder in place
  // (no navigation), instead of redirecting to a separate management page.
  return { saved: true, wave: data as WaveRow };
}

export async function updateWave(
  _prev: WaveFormState,
  formData: FormData
): Promise<WaveFormState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: strings.wavesSaveFailed };

  const valid = validateWaveFields(formData.get("name"), formData.get("type"));
  if (!valid.ok) return { error: valid.error };

  const { error } = await supabase
    .from("tenants")
    .update({
      name: valid.name,
      type: valid.type,
      // Only touch status when the editor sent it, so callers that don't expose
      // a status field (e.g. the legacy modal form) never reset it.
      ...(formData.has("status")
        ? { status: normalizeWaveStatus(formData.get("status")) }
        : {}),
      description_html:
        sanitizeDescription(formData.get("description_html")) || null,
    })
    .eq("id", id);
  if (error) {
    await logError({
      operation: "updateWave",
      surface: "admin",
      error,
      context: { waveId: id },
    });
    return { error: strings.wavesSaveFailed };
  }

  revalidatePath(LIST_PATH);
  revalidatePath(wavePath(id));
  await invalidate(adminListKey("waves"));
  return { saved: true };
}

/**
 * Delete a wave permanently. Its content (weeks/materials/assignments/submissions)
 * cascades away; its assigned members are KEPT but unassigned — their tenant_id is
 * set to null (migration 0009 switched the FK to ON DELETE SET NULL). So removing a
 * wave never deletes a member's account, it just clears their wave column.
 */
export async function deleteWave(
  _prev: RemoveWaveState,
  formData: FormData
): Promise<RemoveWaveState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: strings.wavesRemoveFailed };

  // Gather before the delete: members to unassign (to drop their cached profile)
  // and storage objects to clean up (DB rows cascade, but files do not).
  const [{ data: members }, { data: materials }, { data: assignments }, { data: subs }] =
    await Promise.all([
      supabase.from("students").select("user_id").eq("tenant_id", id),
      supabase.from("wave_materials").select("file_path").eq("tenant_id", id),
      supabase.from("wave_assignments").select("file_path").eq("tenant_id", id),
      supabase.from("wave_submissions").select("file_path").eq("tenant_id", id),
    ]);

  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) {
    await logError({
      operation: "deleteWave",
      surface: "admin",
      error,
      context: { waveId: id },
    });
    return { error: strings.wavesRemoveFailed };
  }

  // Materials AND assignment files share the materials bucket.
  await removeObjects(supabase, MATERIALS_BUCKET, [
    ...(materials ?? []).map((m) => m.file_path),
    ...(assignments ?? []).map((a) => a.file_path),
  ]);
  await removeObjects(
    supabase,
    SUBMISSIONS_BUCKET,
    (subs ?? []).map((s) => s.file_path)
  );

  revalidatePath(LIST_PATH);
  revalidatePath("/admin/members");
  await invalidate(adminListKey("waves"), adminListKey("members"));
  // Each now-unassigned member's profile was cached under the old wave id — drop it.
  for (const m of members ?? []) {
    if (m.user_id) await invalidate(studentKey(id, m.user_id, "profile"));
  }
  return { removed: true };
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

export async function addWeek(
  _prev: WeekState,
  formData: FormData
): Promise<WeekState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const waveId = formData.get("wave_id");
  if (typeof waveId !== "string" || !waveId)
    return { error: strings.wavesWeekSaveFailed };

  // Server-assign the next position (current max + 1).
  const { data: last } = await supabase
    .from("wave_weeks")
    .select("position")
    .eq("tenant_id", waveId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;

  const title = formData.get("title");
  const { data, error } = await supabase
    .from("wave_weeks")
    .insert({
      tenant_id: waveId,
      position,
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      description_html:
        sanitizeDescription(formData.get("description_html")) || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    await logError({
      operation: "addWeek",
      surface: "admin",
      error: error ?? "insert returned no row",
      context: { waveId },
    });
    return { error: strings.wavesWeekSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  // Return the new week's id so the one-page builder can attach this week's
  // materials and assignments to it during a batched Save.
  return { saved: true, id: data.id as string };
}

export async function updateWeek(
  _prev: WeekState,
  formData: FormData
): Promise<WeekState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesWeekSaveFailed };

  const title = formData.get("title");
  const { error } = await supabase
    .from("wave_weeks")
    .update({
      title: typeof title === "string" && title.trim() ? title.trim() : null,
      description_html:
        sanitizeDescription(formData.get("description_html")) || null,
    })
    .eq("id", id);
  if (error) {
    await logError({
      operation: "updateWeek",
      surface: "admin",
      error,
      context: { weekId: id, waveId },
    });
    return { error: strings.wavesWeekSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function removeWeek(
  _prev: WeekState,
  formData: FormData
): Promise<WeekState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesWeekSaveFailed };

  // Best-effort cleanup of files owned by this week before the cascade delete.
  const { data: materials } = await supabase
    .from("wave_materials")
    .select("file_path")
    .eq("week_id", id);
  const { data: assignments } = await supabase
    .from("wave_assignments")
    .select("id, file_path")
    .eq("week_id", id);
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  let submissionPaths: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: subs } = await supabase
      .from("wave_submissions")
      .select("file_path")
      .in("assignment_id", assignmentIds);
    submissionPaths = (subs ?? []).map((s) => s.file_path);
  }

  const { error } = await supabase.from("wave_weeks").delete().eq("id", id);
  if (error) {
    await logError({
      operation: "removeWeek",
      surface: "admin",
      error,
      context: { weekId: id, waveId },
    });
    return { error: strings.wavesWeekSaveFailed };
  }

  // Materials AND assignment files both live in the materials bucket.
  await removeObjects(supabase, MATERIALS_BUCKET, [
    ...(materials ?? []).map((m) => m.file_path),
    ...(assignments ?? []).map((a) => a.file_path),
  ]);
  await removeObjects(supabase, SUBMISSIONS_BUCKET, submissionPaths);

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export async function addMaterial(
  _prev: MaterialState,
  formData: FormData
): Promise<MaterialState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  const title = formData.get("title");
  if (
    typeof waveId !== "string" ||
    !waveId ||
    typeof weekId !== "string" ||
    !weekId ||
    typeof title !== "string" ||
    !title.trim()
  ) {
    return { error: strings.wavesMaterialSaveFailed };
  }

  // The file itself was uploaded straight from the browser to Storage (Server
  // Action bodies are capped at ~4.5 MB on Vercel); the action only records the
  // object's path after verifying it points inside THIS wave + week.
  const filePath = formData.get("file_path");
  if (
    typeof filePath !== "string" ||
    !isMaterialObjectPath(filePath, waveId, weekId, "material")
  ) {
    return { error: strings.wavesMaterialInvalid };
  }

  const { error } = await supabase.from("wave_materials").insert({
    tenant_id: waveId,
    week_id: weekId,
    title: title.trim(),
    file_path: filePath,
  });
  if (error) {
    await logError({
      operation: "addMaterial",
      surface: "admin",
      error,
      context: { waveId, weekId },
    });
    await removeObjects(supabase, MATERIALS_BUCKET, [filePath]);
    return { error: strings.wavesMaterialSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function removeMaterial(
  _prev: MaterialState,
  formData: FormData
): Promise<MaterialState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesMaterialSaveFailed };

  const { data: existing } = await supabase
    .from("wave_materials")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("wave_materials").delete().eq("id", id);
  if (error) {
    await logError({
      operation: "removeMaterial",
      surface: "admin",
      error,
      context: { materialId: id, waveId },
    });
    return { error: strings.wavesMaterialSaveFailed };
  }

  await removeObjects(supabase, MATERIALS_BUCKET, [existing?.file_path]);

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

function parseDueAt(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function addAssignment(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  const title = formData.get("title");
  if (
    typeof waveId !== "string" ||
    !waveId ||
    typeof weekId !== "string" ||
    !weekId ||
    typeof title !== "string" ||
    !title.trim()
  ) {
    return { error: strings.wavesAssignmentSaveFailed };
  }

  // An assignment is an admin-uploaded file (like a material); its title is the
  // original filename, sent by the client alongside the already-uploaded
  // object's path (browser→Storage direct upload; see addMaterial).
  const filePath = formData.get("file_path");
  if (
    typeof filePath !== "string" ||
    !isMaterialObjectPath(filePath, waveId, weekId, "assignment")
  ) {
    return { error: strings.wavesMaterialInvalid };
  }

  const { error } = await supabase.from("wave_assignments").insert({
    tenant_id: waveId,
    week_id: weekId,
    title: title.trim(),
    file_path: filePath,
  });
  if (error) {
    await logError({
      operation: "addAssignment",
      surface: "admin",
      error,
      context: { waveId, weekId },
    });
    await removeObjects(supabase, MATERIALS_BUCKET, [filePath]);
    return { error: strings.wavesAssignmentSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function updateAssignment(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  const title = formData.get("title");
  if (
    typeof id !== "string" ||
    !id ||
    typeof waveId !== "string" ||
    !waveId ||
    typeof title !== "string" ||
    !title.trim()
  ) {
    return { error: strings.wavesAssignmentSaveFailed };
  }

  const { error } = await supabase
    .from("wave_assignments")
    .update({
      title: title.trim(),
      instructions_html:
        sanitizeDescription(formData.get("instructions_html")) || null,
      due_at: parseDueAt(formData.get("due_at")),
    })
    .eq("id", id);
  if (error) {
    await logError({
      operation: "updateAssignment",
      surface: "admin",
      error,
      context: { assignmentId: id, waveId },
    });
    return { error: strings.wavesAssignmentSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function removeAssignment(
  _prev: AssignmentState,
  formData: FormData
): Promise<AssignmentState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesAssignmentSaveFailed };

  const [{ data: existing }, { data: subs }] = await Promise.all([
    supabase.from("wave_assignments").select("file_path").eq("id", id).maybeSingle(),
    supabase.from("wave_submissions").select("file_path").eq("assignment_id", id),
  ]);

  const { error } = await supabase
    .from("wave_assignments")
    .delete()
    .eq("id", id);
  if (error) {
    await logError({
      operation: "removeAssignment",
      surface: "admin",
      error,
      context: { assignmentId: id, waveId },
    });
    return { error: strings.wavesAssignmentSaveFailed };
  }

  // The assignment's own uploaded file lives in the materials bucket; student
  // submissions live in the submissions bucket. Clean up both (best-effort).
  await removeObjects(supabase, MATERIALS_BUCKET, [existing?.file_path]);
  await removeObjects(
    supabase,
    SUBMISSIONS_BUCKET,
    (subs ?? []).map((s) => s.file_path)
  );

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Videos (Google Drive links — no Storage upload; we persist only the file id)
// ---------------------------------------------------------------------------

/** A non-empty title within the length cap; null on failure. */
function validVideoTitle(value: FormDataEntryValue | null): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  if (!t || t.length > MAX_VIDEO_TITLE_LEN) return null;
  return t;
}

export async function addVideo(
  _prev: VideoState,
  formData: FormData
): Promise<VideoState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  if (typeof waveId !== "string" || !waveId || typeof weekId !== "string" || !weekId)
    return { error: strings.wavesVideoSaveFailed };

  const title = validVideoTitle(formData.get("title"));
  if (!title) return { error: strings.wavesVideoTitleRequired };

  // The admin pastes a Google Drive share link; we extract and store ONLY the
  // file id, then build the embed URL ourselves at render (never trust raw input
  // as an iframe src).
  const driveFileId = parseDriveFileId(
    formData.get("drive_link") as string | null
  );
  if (!driveFileId) return { error: strings.wavesVideoLinkInvalid };

  // Server-assign the next position (current max + 1) within the week.
  const { data: last } = await supabase
    .from("wave_videos")
    .select("position")
    .eq("week_id", weekId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("wave_videos").insert({
    tenant_id: waveId,
    week_id: weekId,
    title,
    drive_file_id: driveFileId,
    position,
  });
  if (error) {
    await logError({
      operation: "addVideo",
      surface: "admin",
      error,
      context: { waveId, weekId },
    });
    return { error: strings.wavesVideoSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function updateVideo(
  _prev: VideoState,
  formData: FormData
): Promise<VideoState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesVideoSaveFailed };

  const title = validVideoTitle(formData.get("title"));
  if (!title) return { error: strings.wavesVideoTitleRequired };

  const driveFileId = parseDriveFileId(
    formData.get("drive_link") as string | null
  );
  if (!driveFileId) return { error: strings.wavesVideoLinkInvalid };

  const { error } = await supabase
    .from("wave_videos")
    .update({ title, drive_file_id: driveFileId })
    .eq("id", id);
  if (error) {
    await logError({
      operation: "updateVideo",
      surface: "admin",
      error,
      context: { videoId: id, waveId },
    });
    return { error: strings.wavesVideoSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function reorderVideo(
  _prev: VideoState,
  formData: FormData
): Promise<VideoState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  const weekId = formData.get("week_id");
  const direction = formData.get("direction");
  if (
    typeof id !== "string" ||
    !id ||
    typeof waveId !== "string" ||
    !waveId ||
    typeof weekId !== "string" ||
    !weekId ||
    (direction !== "up" && direction !== "down")
  ) {
    return { error: strings.wavesVideoSaveFailed };
  }

  // Load the week's videos in display order and swap this one with its neighbour.
  const { data: rows } = await supabase
    .from("wave_videos")
    .select("id, position")
    .eq("week_id", weekId)
    .order("position", { ascending: true });
  const list = (rows ?? []) as { id: string; position: number }[];
  const idx = list.findIndex((v) => v.id === id);
  if (idx < 0) return { error: strings.wavesVideoSaveFailed };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return { saved: true }; // no-op at the ends

  const a = list[idx];
  const b = list[swapIdx];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("wave_videos").update({ position: b.position }).eq("id", a.id),
    supabase.from("wave_videos").update({ position: a.position }).eq("id", b.id),
  ]);
  if (e1 || e2) {
    await logError({
      operation: "reorderVideo",
      surface: "admin",
      error: e1 ?? e2,
      context: { videoId: id, waveId },
    });
    return { error: strings.wavesVideoSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}

export async function removeVideo(
  _prev: VideoState,
  formData: FormData
): Promise<VideoState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  const waveId = formData.get("wave_id");
  if (typeof id !== "string" || !id || typeof waveId !== "string" || !waveId)
    return { error: strings.wavesVideoSaveFailed };

  const { error } = await supabase.from("wave_videos").delete().eq("id", id);
  if (error) {
    await logError({
      operation: "removeVideo",
      surface: "admin",
      error,
      context: { videoId: id, waveId },
    });
    return { error: strings.wavesVideoSaveFailed };
  }

  revalidatePath(wavePath(waveId));
  return { saved: true };
}
