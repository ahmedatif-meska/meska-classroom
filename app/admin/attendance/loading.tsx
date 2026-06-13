import strings from "@/lib/strings";

export default function AttendanceLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-sm text-[var(--color-ink)] opacity-50 animate-pulse">
        {strings.loadingLabel}
      </p>
    </div>
  );
}
