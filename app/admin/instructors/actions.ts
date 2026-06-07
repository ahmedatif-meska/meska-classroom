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
import { invalidate } from "@/lib/cache/redis";
import { adminListKey } from "@/lib/cache/keys";
import strings from "@/lib/strings";

export type InstructorFormState = { error?: string; saved?: boolean };
export type RemoveInstructorState = { error?: string; removed?: boolean };

const LIST_PATH = "/admin/instructors";
const BUCKET = "instructor-images";

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
  if (error) return { error: strings.instructorsImageUploadFailed };
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

  const valid = validateInstructorFields(formData.get("name"));
  if (!valid.ok) return { error: valid.error };

  let imagePath: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const uploaded = await uploadImage(supabase, image);
    if ("error" in uploaded) return { error: uploaded.error };
    imagePath = uploaded.path;
  }

  const descriptionHtml = sanitizeDescription(formData.get("description_html"));

  const { error } = await supabase.from("instructors").insert({
    name: valid.name,
    description_html: descriptionHtml || null,
    image_path: imagePath,
  });
  if (error) return { error: strings.instructorsSaveFailed };

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("instructors"));
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

  const valid = validateInstructorFields(formData.get("name"));
  if (!valid.ok) return { error: valid.error };

  const update: {
    name: string;
    description_html: string | null;
    updated_at: string;
    image_path?: string;
  } = {
    name: valid.name,
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
  if (error) return { error: strings.instructorsSaveFailed };

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("instructors"));
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
  if (error) return { error: strings.instructorsRemoveFailed };

  await removeImage(supabase, existing?.image_path);

  revalidatePath(LIST_PATH);
  await invalidate(adminListKey("instructors"));
  return { removed: true };
}
