import Link from "next/link";
import strings from "@/lib/strings";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center gap-2">
      <h2 className="text-xl font-semibold text-[var(--color-ink)]">
        {strings.notFoundTitle}
      </h2>
      <Link
        href="/admin"
        className="mt-2 text-sm font-medium text-[var(--color-brand)] underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] rounded-sm"
      >
        {strings.notFoundBackLabel}
      </Link>
    </div>
  );
}
