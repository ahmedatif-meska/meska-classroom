import strings from "@/lib/strings";
import AdminLoginForm from "@/components/AdminLoginForm";

function LockIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function AdminHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-surface p-8 shadow-sm sm:p-10">
        <div className="flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white">
            <LockIcon />
          </span>
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold text-ink">
          {strings.adminPortalTitle}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {strings.adminPortalSubtitle}
        </p>

        <AdminLoginForm />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        {strings.adminHelpNote}
      </p>
    </div>
    </main>
  );
}
