"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WaveForm, { type WaveRow } from "@/components/WaveForm";
import strings from "@/lib/strings";

/** Edit a wave's name/description/type in a modal (reuses WaveForm). */
export default function EditWaveModal({ wave }: { wave: WaveRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {strings.waveEditLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-wave-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lg sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <h2 id="edit-wave-title" className="text-xl font-bold text-ink">
                {strings.waveFormEditTitle}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.closeLabel}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ✕
              </button>
            </div>
            <div className="mt-6">
              <WaveForm
                wave={wave}
                onCancel={() => setOpen(false)}
                onSaved={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
