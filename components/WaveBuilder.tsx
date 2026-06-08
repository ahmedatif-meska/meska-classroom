"use client";

import { useState } from "react";
import {
  createWave,
  updateWave,
  type WaveFormState,
} from "@/app/admin/waves/actions";
import { validateWaveFields, WAVE_TYPES } from "@/lib/waves/validation";
import RichTextEditor from "@/components/RichTextEditor";
import WaveContentManager from "@/components/WaveContentManager";
import type { WaveRow } from "@/lib/waves/content";
import strings from "@/lib/strings";

const inputClass =
  "rounded-2xl border border-slate-200 bg-page px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const TYPE_LABELS: Record<(typeof WAVE_TYPES)[number], string> = {
  online: strings.waveTypeOnline,
  offline: strings.waveTypeOffline,
};

/**
 * One-page wave builder. The basics (name, type, description) and the
 * weeks/materials/assignments builder live on the same screen; a single Save
 * button sits at the END of the page (below the weeks section). The first Save
 * creates the wave and unlocks the weeks section (a wave must exist before
 * weeks/files can attach — storage paths are keyed by wave id); later Saves
 * update the basics. Weeks/materials/assignments each persist as they're added.
 */
export default function WaveBuilder() {
  const [wave, setWave] = useState<WaveRow | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"online" | "offline" | "">("");
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const handleSave = async () => {
    const pre = validateWaveFields(name, type);
    if (!pre.ok) {
      setError(pre.error);
      setSaved(false);
      return;
    }
    setError(null);

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("type", type);
    fd.set("description_html", html);

    setPending(true);
    if (wave) {
      fd.set("id", wave.id);
      const res: WaveFormState = await updateWave({}, fd);
      setPending(false);
      if (res.saved) setSaved(true);
      else setError(res.error ?? strings.wavesSaveFailed);
    } else {
      const res: WaveFormState = await createWave({}, fd);
      setPending(false);
      if (res.wave) {
        setWave(res.wave);
        setSaved(true);
      } else {
        setError(res.error ?? strings.wavesSaveFailed);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Basics — no button in this card; Save lives at the end of the page. */}
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="wave-name" className="text-sm font-bold text-ink">
              {strings.waveNameLabel} *
            </label>
            <input
              id="wave-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder={strings.waveNamePlaceholder}
              className={inputClass}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-bold text-ink">
              {strings.waveTypeLabel} *
            </legend>
            <div className="flex flex-wrap gap-3">
              {WAVE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => {
                    setType(t);
                    setSaved(false);
                  }}
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
            onChange={(h) => {
              setHtml(h);
              setSaved(false);
            }}
          />
        </div>
      </div>

      {/* Weeks / materials / assignments — unlock once the wave is saved. */}
      {wave ? (
        <WaveContentManager waveId={wave.id} />
      ) : (
        <div>
          <h2 className="text-lg font-bold text-ink">{strings.wavesNavLabel}</h2>
          <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-surface px-4 py-6 text-sm text-slate-500">
            {strings.waveBuilderWeeksLocked}
          </p>
        </div>
      )}

      {/* Save — at the end of the page. */}
      <div className="flex max-w-2xl flex-col gap-3">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
          >
            {pending
              ? strings.waveFormSubmittingLabel
              : strings.waveFormSubmitLabel}
          </button>
          {saved && !pending ? (
            <span role="status" className="text-sm font-medium text-slate-500">
              {strings.waveSavedNote}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
