import Link from "next/link";
import strings from "@/lib/strings";
import StudentSetPasswordForm from "@/components/StudentSetPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { assertStudentSession } from "@/lib/auth/studentGate";

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

export default async function StudentSetPassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // A valid member invite/recovery session must be present (established by the
  // confirm route). Absent it — or with ?error=link — show the invalid-link state.
  let validSession = false;
  if (error !== "link") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    validSession = assertStudentSession(user ? { user } : null).ok;
  }

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
            {strings.studentSetPasswordTitle}
          </h1>

          {validSession ? (
            <>
              <p className="mt-2 text-center text-sm text-slate-500">
                {strings.studentSetPasswordSubtitle}
              </p>
              <StudentSetPasswordForm />
            </>
          ) : (
            <>
              <p
                role="alert"
                className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {strings.studentResetLinkInvalid}
              </p>
              <Link
                href="/student"
                className="mt-5 block text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
              >
                {strings.backToSignInLabel}
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
