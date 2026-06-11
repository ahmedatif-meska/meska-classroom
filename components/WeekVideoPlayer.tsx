"use client";

import { useState } from "react";
import strings from "@/lib/strings";

/**
 * Inline week-video player (the smallest client island on the week page). It
 * renders a lightweight poster with a play button; the heavy Google Drive
 * `/preview` iframe is mounted ONLY when the student presses play (click-to-load
 * façade) so a week with many videos never loads N third-party frames on open —
 * protecting mobile Core Web Vitals (Principle V). The embed URL is always built
 * server-side from the stored Drive file id, never from raw admin input.
 */
export default function WeekVideoPlayer({
  title,
  embedUrl,
  watchUrl,
}: {
  title: string;
  embedUrl: string;
  watchUrl: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-ink/90 shadow-sm">
        {playing ? (
          <iframe
            src={embedUrl}
            title={title}
            loading="lazy"
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`${strings.studentVideoPlayLabel}: ${title}`}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white/80 transition group-hover:bg-white/20">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold text-ink">
          {title}
        </span>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.studentVideoOpenInDrive}
        </a>
      </figcaption>
    </figure>
  );
}
