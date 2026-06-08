"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import {
  validateWaveFields,
  validateMaterialFile,
  extensionForType,
} from "@/lib/waves/validation";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import {
  MATERIALS_BUCKET,
  SUBMISSIONS_BUCKET,
  materialPath,
} from "@/lib/waves/files";
import { invalidate } from "@/lib/cache/redis";
import { adminListKey } from "@/lib/cache/keys";
import strings from "@/lib/strings";

export type WaveFormState = { error?: string; saved?: boolean };
export type RemoveWaveState = { error?: string; removed?: boolean };
export type WeekState = { error?: string; saved?: boolean };
export type MaterialState = { error?: string; saved?: boolean };
export type AssignmentState = { error?: string; saved?: boolean };

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

  const { error } = await supabase.from("tenants").insert({
    name: valid.name,
    type: valid.type,
    description_html: sanitizeDescription(formData.get("description_html")) || null,
  });
  if (error) return { error: strings.wavesSaveFailed };

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("waves"));
  return { saved: true };
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
      description_html:
        sanitizeDescription(formData.get("description_html")) || null,
    })
    .eq("id", id);
  if (error) return { error: strings.wavesSaveFailed };

  revalidatePath(LIST_PATH);
  revalidatePath(wavePath(id));
  await invalidate(adminListKey("waves"));
  return { saved: true };
}

/** Block-while-non-empty (R11): refuse if the wave has members or weeks. */
export async function deleteWave(
  _prev: RemoveWaveState,
  formData: FormData
): Promise<RemoveWaveState> {
  const gate = await adminClient();
  if (!gate) return { error: strings.wavesForbidden };
  const { supabase } = gate;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: strings.wavesRemoveFailed };

  const [{ count: members }, { count: weeks }] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id),
    supabase
      .from("wave_weeks")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id),
  ]);
  if ((members ?? 0) > 0 || (weeks ?? 0) > 0) {
    return { error: strings.wavesDeleteBlocked };
  }

  const { error } = await supabase.from("tenants").delete().eq("id", id);
  if (error) return { error: strings.wavesRemoveFailed };

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("waves"));
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
  const { error } = await supabase.from("wave_weeks").insert({
    tenant_id: waveId,
    position,
    title: typeof title === "string" && title.trim() ? title.trim() : null,
    description_html:
      sanitizeDescription(formData.get("description_html")) || null,
  });
  if (error) return { error: strings.wavesWeekSaveFailed };

  revalidatePath(wavePath(waveId));
  return { saved: true };
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
  if (error) return { error: strings.wavesWeekSaveFailed };

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
    .select("id")
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
  if (error) return { error: strings.wavesWeekSaveFailed };

  await removeObjects(
    supabase,
    MATERIALS_BUCKET,
    (materials ?? []).map((m) => m.file_path)
  );
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

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: strings.wavesMaterialInvalid };

  const check = validateMaterialFile({ type: file.type, size: file.size });
  if (!check.ok) return { error: check.error };

  const path = materialPath(
    waveId,
    weekId,
    crypto.randomUUID(),
    extensionForType(file.type)
  );
  const { error: upErr } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: strings.wavesMaterialUploadFailed };

  const { error } = await supabase.from("wave_materials").insert({
    tenant_id: waveId,
    week_id: weekId,
    title: title.trim(),
    file_path: path,
  });
  if (error) {
    await removeObjects(supabase, MATERIALS_BUCKET, [path]);
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
  if (error) return { error: strings.wavesMaterialSaveFailed };

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

  const { error } = await supabase.from("wave_assignments").insert({
    tenant_id: waveId,
    week_id: weekId,
    title: title.trim(),
    instructions_html:
      sanitizeDescription(formData.get("instructions_html")) || null,
    due_at: parseDueAt(formData.get("due_at")),
  });
  if (error) return { error: strings.wavesAssignmentSaveFailed };

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
  if (error) return { error: strings.wavesAssignmentSaveFailed };

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

  const { data: subs } = await supabase
    .from("wave_submissions")
    .select("file_path")
    .eq("assignment_id", id);

  const { error } = await supabase
    .from("wave_assignments")
    .delete()
    .eq("id", id);
  if (error) return { error: strings.wavesAssignmentSaveFailed };

  await removeObjects(
    supabase,
    SUBMISSIONS_BUCKET,
    (subs ?? []).map((s) => s.file_path)
  );

  revalidatePath(wavePath(waveId));
  return { saved: true };
}
