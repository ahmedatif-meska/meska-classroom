import Link from "next/link";
import strings from "@/lib/strings";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-2xl font-semibold text-[var(--color-ink)] mb-2">
        {strings.notFoundTitle}
      </h1>
      <Link
        href="/"
        className="mt-4 text-sm font-medium text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] rounded-sm"
      >
        {strings.notFoundBackLabel}
      </Link>
    </div>
  );
}
