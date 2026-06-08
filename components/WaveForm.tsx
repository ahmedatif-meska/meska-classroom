"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createWave,
  updateWave,
  type WaveFormState,
} from "@/app/admin/waves/actions";
import { validateWaveFields, WAVE_TYPES } from "@/lib/waves/validation";
import RichTextEditor from "@/components/RichTextEditor";
import strings from "@/lib/strings";

export type WaveRow = {
  id: string;
  name: string;
  description_html: string | null;
  type: "online" | "offline";
  created_at: string;
};

const initialState: WaveFormState = {};

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const TYPE_LABELS: Record<(typeof WAVE_TYPES)[number], string> = {
  online: strings.waveTypeOnline,
  offline: strings.waveTypeOffline,
};

/**
 * Shared create/edit form for a wave (name, rich-text description, Online/Offline
 * type). The same surface backs the Waves-tab create page and the edit modal on a
 * wave's page (FR-006). Client-side validation pre-checks before the server action
 * re-validates authoritatively.
 */
export default function WaveForm({
  wave,
  onCancel,
  onSaved,
  redirectTo,
}: {
  wave?: WaveRow;
  onCancel?: () => void;
  onSaved?: () => void;
  /** Serializable alternative to onSaved, usable from a Server Component parent. */
  redirectTo?: string;
}) {
  const isEdit = Boolean(wave);
  const router = useRouter();
  const [type, setType] = useState<"online" | "offline" | "">(wave?.type ?? "");
  const [clientError, setClientError] = useState<string | null>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: WaveFormState, formData: FormData) => {
      const pre = validateWaveFields(formData.get("name"), formData.get("type"));
      if (!pre.ok) {
        setClientError(pre.error);
        return prev;
      }
      setClientError(null);
      const result = isEdit
        ? await updateWave(prev, formData)
        : await createWave(prev, formData);
      if (result.saved) {
        onSaved?.();
        if (redirectTo) router.push(redirectTo);
      }
      return result;
    },
    initialState
  );

  const error = clientError ?? state.error;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="id" value={wave!.id} /> : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="wave-name" className="text-sm font-bold text-ink">
          {strings.waveNameLabel} *
        </label>
        <input
          id="wave-name"
          name="name"
          type="text"
          required
          defaultValue={wave?.name ?? ""}
          placeholder={strings.waveNamePlaceholder}
          className={inputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-bold text-ink">
          {strings.waveTypeLabel} *
        </legend>
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-wrap gap-3">
          {WAVE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={`rounded-full border px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                type === t
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-200 text-ink hover:bg-slate-50"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </fieldset>

      <RichTextEditor
        name="description_html"
        label={strings.waveDescriptionLabel}
        initialHtml={wave?.description_html ?? ""}
      />

      <div className="mt-2 flex justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {strings.cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending
            ? strings.waveFormSubmittingLabel
            : strings.waveFormSubmitLabel}
        </button>
      </div>
    </form>
  );
}
