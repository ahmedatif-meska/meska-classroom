"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createInstructor,
  updateInstructor,
  type InstructorFormState,
} from "@/app/admin/instructors/actions";
import { validateImageFile } from "@/lib/instructors/validation";
import { instructorImageUrl } from "@/lib/instructors/image";
import RichTextEditor from "@/components/RichTextEditor";
import ImageCropper from "@/components/ImageCropper";
import strings from "@/lib/strings";

export type InstructorRow = {
  id: string;
  name: string;
  title: string | null;
  description_html: string | null;
  image_path: string | null;
  created_at: string;
  position: number;
};

const initialState: InstructorFormState = {};

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function InstructorFormModal({
  instructor,
}: {
  instructor?: InstructorRow;
}) {
  const isEdit = Boolean(instructor);
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    instructorImageUrl(instructor?.image_path)
  );

  const [state, formAction, pending] = useActionState(
    async (prev: InstructorFormState, formData: FormData) => {
      // The form's file input holds the raw pick; replace it with the cropped
      // square the user framed, so that's what gets uploaded (FR-007 still
      // re-validates it server-side).
      if (croppedFile) formData.set("image", croppedFile);
      const result = isEdit
        ? await updateInstructor(prev, formData)
        : await createInstructor(prev, formData);
      if (result.saved) setOpen(false);
      return result;
    },
    initialState
  );

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    // Reset to the instructor's current image (Edit) or nothing (Add) so a prior
    // session's preview/crop never leaks into a freshly opened form.
    setImageError(null);
    setPendingFile(null);
    setCroppedFile(null);
    setPreviewUrl(instructorImageUrl(instructor?.image_path));
  }

  function open_() {
    reset();
    setOpen(true);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile({ type: file.type, size: file.size });
    if (!check.ok) {
      setImageError(check.error);
      setPendingFile(null);
      setCroppedFile(null);
      e.target.value = "";
      return;
    }
    setImageError(null);
    // Hand the raw pick to the cropper; it emits the framed square via onCropped.
    setPendingFile(file);
  }

  const titleId = `instructor-form-${instructor?.id ?? "new"}`;

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={open_}
          aria-label={`${strings.instructorEditLabel} — ${instructor!.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <EditIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={open_}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.instructorsAddLabel}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-xl font-bold text-ink">
                {isEdit
                  ? strings.instructorFormEditTitle
                  : strings.instructorFormAddTitle}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label={strings.closeLabel}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {strings.instructorFormSubtitle}
            </p>

            {state.error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {state.error}
              </p>
            ) : null}

            <form action={formAction} className="mt-6 flex flex-col gap-5">
              {isEdit ? (
                <input type="hidden" name="id" value={instructor!.id} />
              ) : null}

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${titleId}-name`}
                  className="text-sm font-bold text-ink"
                >
                  {strings.instructorNameLabel} *
                </label>
                <input
                  id={`${titleId}-name`}
                  name="name"
                  type="text"
                  required
                  defaultValue={instructor?.name ?? ""}
                  placeholder={strings.instructorNamePlaceholder}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${titleId}-title`}
                  className="text-sm font-bold text-ink"
                >
                  {strings.instructorTitleLabel} *
                </label>
                <input
                  id={`${titleId}-title`}
                  name="title"
                  type="text"
                  required
                  defaultValue={instructor?.title ?? ""}
                  placeholder={strings.instructorTitlePlaceholder}
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${titleId}-image`}
                  className="text-sm font-bold text-ink"
                >
                  {strings.instructorImageLabel}
                </label>
                {pendingFile ? (
                  <ImageCropper
                    file={pendingFile}
                    onChange={(file, url) => {
                      setCroppedFile(file);
                      setPreviewUrl(url);
                    }}
                  />
                ) : previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt=""
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                ) : null}
                <input
                  id={`${titleId}-image`}
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={onPickImage}
                  className="text-sm text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand"
                />
                <p className="text-xs text-slate-500">
                  {strings.instructorImageHelp}
                </p>
                {imageError ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
                  >
                    {imageError}
                  </p>
                ) : null}
              </div>

              <RichTextEditor initialHtml={instructor?.description_html ?? ""} />

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {strings.cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
                >
                  {pending
                    ? strings.instructorFormSubmittingLabel
                    : strings.instructorFormSubmitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
