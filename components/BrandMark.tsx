type BrandMarkProps = {
  className?: string;
  /** Accessible name. When omitted, the mark is decorative (aria-hidden). */
  title?: string;
};

/**
 * Canonical Meska Classroom logo — a graduation-cap mark drawn with
 * `currentColor`, so callers set its size and color via `className`
 * (e.g. `h-16 w-16 text-brand`).
 */
export default function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2.5 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}
