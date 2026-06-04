import strings from "@/lib/strings";

/**
 * Renders a member's QR code (an inline SVG produced server-side by
 * `renderQrSvg`) or a placeholder when none is available. Kept sync — the page
 * does the async rendering and passes the SVG string in — so the QR is
 * dimension-reserved (no layout shift) and easy to test.
 */
export default function MemberQrCode({ svg }: { svg: string | null }) {
  if (!svg) {
    return (
      <div className="flex h-60 w-60 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface p-4 text-center text-sm text-slate-400">
        {strings.studentQrPlaceholder}
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={strings.studentQrAlt}
      className="h-60 w-60 rounded-2xl bg-white p-3 shadow-sm [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
