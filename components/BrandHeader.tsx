import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import strings from "@/lib/strings";

type BrandHeaderProps = {
  /** The caller's panel home — student passes `/student`, admin `/admin`. */
  homeHref: string;
};

/** Persistent top bar: the brand mark + wordmark, linking to panel home. */
export default function BrandHeader({ homeHref }: BrandHeaderProps) {
  return (
    <header className="z-10 border-b border-black/5 bg-surface/80 backdrop-blur-sm">
      <Link
        href={homeHref}
        aria-label={strings.logoAriaLabel}
        className="inline-flex items-center gap-2 px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <BrandMark className="h-6 w-6 text-brand" />
        <span className="text-lg font-bold text-brand">{strings.logoAlt}</span>
      </Link>
    </header>
  );
}
