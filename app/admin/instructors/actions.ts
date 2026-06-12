"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdminSession } from "@/lib/auth/adminGate";
import {
  validateInstructorFields,
  validateImageFile,
  extensionForType,
} from "@/lib/instructors/validation";
import { sanitizeDescription } from "@/lib/instructors/sanitize";
import { logError } from "@/lib/errors/log";
import { invalidate } from "@/lib/cache/redis";
import { adminListKey } from "@/lib/cache/keys";
import strings from "@/lib/strings";

export type InstructorFormState = { error?: string; saved?: boolean };
export type RemoveInstructorState = { error?: string; removed?: boolean };
export type ReorderInstructorsState = { error?: string; saved?: boolean };

const LIST_PATH = "/admin/instructors";
// Instructor changes surface on the student Home "About instructors" section.
const STUDENT_HOME_PATH = "/student/dashboard";
const BUCKET = "instructor-images";

/** Revalidate both the admin list and the student Home, and drop the cache. */
async function revalidateInstructors(): Promise<void> {
  revalidatePath(LIST_PATH);
  revalidatePath(STUDENT_HOME_PATH);
  await invalidate(adminListKey("instructors"));
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Upload a validated image File to the bucket; returns its object path or an error. */
async function uploadImage(
  supabase: SupabaseServerClient,
  image: File
): Promise<{ path: string } | { error: string }> {
  const check = validateImageFile({ type: image.type, size: image.size });
  if (!check.ok) return { error: check.error };
  const path = `${crypto.randomUUID()}.${extensionForType(image.type)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, image, { contentType: image.type, upsert: false });
  if (error) {
    await logError({
      operation: "uploadInstructorImage",
      surface: "admin",
      error,
      context: { contentType: image.type, size: image.size },
    });
    return { error: strings.instructorsImageUploadFailed };
  }
  return { path };
}

/** Best-effort removal of a storage object — never fails the calling action (R11). */
async function removeImage(
  supabase: SupabaseServerClient,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* cleanup is best-effort; an orphaned object is harmless */
  }
}

/**
 * createInstructor — add an instructor (gated Server Action).
 *
 * Admin-only (assertAdminSession) → required name → validate + upload the image
 * (server-side, FR-007) → SANITIZE the description before persistence (FR-009) →
 * insert. All writes (row + storage) run on the cookie/RLS client under
 * `is_admin()` policies — no service-role (research R5).
 */
export async function createInstructor(
  _prevState: InstructorFormState,
  formData: FormData
): Promise<InstructorFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.instructorsForbidden };
  }

  const valid = validateInstructorFields(
    formData.get("name"),
    formData.get("title")
  );
  if (!valid.ok) return { error: valid.error };

  let imagePath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadImage(supabase, image);
    if ("error" in uploaded) return { error: uploaded.error };
    imagePath = uploaded.path;
  }

  const descriptionHtml = sanitizeDescription(formData.get("description_html"));

  // Append at the bottom: the new instructor's position is the current max + 1.
  const { data: last } = await supabase
    .from("instructors")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("instructors").insert({
    name: valid.name,
    title: valid.title,
    description_html: descriptionHtml || null,
    image_path: imagePath,
    position,
  });
  if (error) {
    await logError({ operation: "createInstructor", surface: "admin", error });
    return { error: strings.instructorsSaveFailed };
  }

  await revalidateInstructors();
  return { saved: true };
}

/**
 * updateInstructor — edit an instructor (gated Server Action).
 *
 * Admin-only → required id + name → optional new image (validated, uploaded;
 * the prior object is best-effort removed) → re-SANITIZE the description →
 * update (bumping updated_at). When no new image is sent, the existing
 * image_path is preserved.
 */
export async function updateInstructor(
  _prevState: InstructorFormState,
  formData: FormData
): Promise<InstructorFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.instructorsForbidden };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: strings.instructorsSaveFailed };
  }

  const valid = validateInstructorFields(
    formData.get("name"),
    formData.get("title")
  );
  if (!valid.ok) return { error: valid.error };

  const update: {
    name: string;
    title: string;
    description_html: string | null;
    updated_at: string;
    image_path?: string;
  } = {
    name: valid.name,
    title: valid.title,
    description_html: sanitizeDescription(formData.get("description_html")) || null,
    updated_at: new Date().toISOString(),
  };

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadImage(supabase, image);
    if ("error" in uploaded) return { error: uploaded.error };
    const { data: existing } = await supabase
      .from("instructors")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    update.image_path = uploaded.path;
    await removeImage(supabase, existing?.image_path);
  }

  const { error } = await supabase
    .from("instructors")
    .update(update)
    .eq("id", id);
  if (error) {
    await logError({
      operation: "updateInstructor",
      surface: "admin",
      error,
      context: { id },
    });
    return { error: strings.instructorsSaveFailed };
  }

  await revalidateInstructors();
  return { saved: true };
}

/**
 * removeInstructor — delete an instructor (gated Server Action).
 *
 * Admin-only → required id → delete the row (cookie/RLS) → best-effort delete
 * the storage object (R11; its failure never fails the removal).
 */
export async function removeInstructor(
  _prevState: RemoveInstructorState,
  formData: FormData
): Promise<RemoveInstructorState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.instructorsForbidden };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: strings.instructorsForbidden };
  }

  const { data: existing } = await supabase
    .from("instructors")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("instructors").delete().eq("id", id);
  if (error) {
    await logError({
      operation: "removeInstructor",
      surface: "admin",
      error,
      context: { id },
    });
    return { error: strings.instructorsRemoveFailed };
  }

  await removeImage(supabase, existing?.image_path);

  await revalidateInstructors();
  return { removed: true };
}

/**
 * reorderInstructors — persist a new display order (gated Server Action).
 *
 * Admin-only → takes the full list of instructor ids in the desired order and
 * writes each row's `position` to its index (1-based). Drag and the keyboard
 * up/down controls both funnel through this. The new order reflects on the
 * student Home (revalidated below).
 */
export async function reorderInstructors(
  orderedIds: string[]
): Promise<ReorderInstructorsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!assertAdminSession(user ? { user } : null).ok) {
    return { error: strings.instructorsForbidden };
  }

  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    !orderedIds.every((id) => typeof id === "string" && id)
  ) {
    return { error: strings.instructorsReorderFailed };
  }

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("instructors")
        .update({ position: index + 1 })
        .eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    await logError({
      operation: "reorderInstructors",
      surface: "admin",
      error: failed.error,
    });
    return { error: strings.instructorsReorderFailed };
  }

  await revalidateInstructors();
  return { saved: true };
}
