"use client";

import { useEffect, useState } from "react";
import { getWaveContent } from "@/app/admin/waves/actions";
import WaveWeeks from "@/components/WaveWeeks";
import type { AdminWeek } from "@/lib/waves/content";

/**
 * Client wrapper that lets the weeks/materials/assignments manager run on the
 * create page (which has no wave id in its route) without navigating away. It
 * holds the content in state and re-fetches via the `getWaveContent` action after
 * each mutation, so the whole wave is built on one page.
 */
export default function WaveContentManager({ waveId }: { waveId: string }) {
  const [weeks, setWeeks] = useState<AdminWeek[]>([]);

  const reload = () => {
    void getWaveContent(waveId).then(setWeeks);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveId]);

  return <WaveWeeks waveId={waveId} weeks={weeks} onMutated={reload} />;
}
