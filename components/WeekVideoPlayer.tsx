/**
 * Inline week-video player. The Google Drive `/preview` frame is shown by default
 * (it renders the video's poster with Drive's own play control), so a student sees
 * the video on the page without an extra click. The embed URL is always built
 * server-side from the stored Drive file id, never from raw admin input.
 *
 * Preview-only: there is no "open in Drive" link, and the iframe is sandboxed
 * WITHOUT `allow-downloads`/`allow-popups`, so the embedded Drive frame cannot
 * start a download or pop out to the Drive page. (True download protection also
 * requires the Drive file's share setting "viewers can download" to be OFF — the
 * bytes are served by Google, not by us.) `loading="lazy"` still defers offscreen
 * frames so a week with many videos does not load them all at once.
 */
export default function WeekVideoPlayer({
  title,
  embedUrl,
}: {
  title: string;
  embedUrl: string;
}) {
  return (
    <figure className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-ink/90 shadow-sm">
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow="autoplay; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="truncate text-sm font-semibold text-ink">
        {title}
      </figcaption>
    </figure>
  );
}
