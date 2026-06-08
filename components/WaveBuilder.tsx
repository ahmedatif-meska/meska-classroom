"use client";

import { useState } from "react";
import WaveForm from "@/components/WaveForm";
import WaveContentManager from "@/components/WaveContentManager";
import type { WaveRow } from "@/lib/waves/content";
import strings from "@/lib/strings";

/**
 * One-page wave creation: the basic-info form and the weeks/materials/assignments
 * builder live on the same screen with no navigation. Creating the wave reveals
 * the content builder in place (the wave must exist before files can attach to it,
 * since storage paths are keyed by wave + week id).
 */
export default function WaveBuilder() {
  const [wave, setWave] = useState<WaveRow | null>(null);

  if (!wave) {
    return (
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8">
        <WaveForm onCreated={setWave} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p
        role="status"
        className="max-w-2xl rounded-2xl bg-brand/10 px-4 py-3 text-sm font-medium text-brand"
      >
        {strings.waveCreatedNote}
      </p>
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8">
        {/* Now in edit mode — refining the basics saves in place, no navigation. */}
        <WaveForm wave={wave} />
      </div>
      <WaveContentManager waveId={wave.id} />
    </div>
  );
}
