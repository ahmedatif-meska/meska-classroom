import strings from "@/lib/strings";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

function KeyIcon() {
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
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.3-8.3" />
      <path d="m17 6 3 3" />
      <path d="m14 9 3 3" />
    </svg>
  );
}

export default function AdminForgotPassword() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-surface p-8 shadow-sm sm:p-10">
          <div className="flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white">
              <KeyIcon />
            </span>
          </div>

          <h1 className="mt-6 text-center text-3xl font-bold text-ink">
            {strings.forgotTitle}
          </h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            {strings.forgotSubtitle}
          </p>

          <ForgotPasswordForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          {strings.adminHelpNote}
        </p>
      </div>
    </main>
  );
}
