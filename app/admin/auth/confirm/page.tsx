import Link from "next/link";
import strings from "@/lib/strings";
import { confirmPasswordReset } from "@/app/admin/actions";

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

/**
 * GET /admin/auth/confirm — interstitial for a password-recovery link.
 *
 * The recovery token is single-use. Rendering this page does NOT consume it: the
 * token is only verified when the admin presses "Continue" (the `confirmPasswordReset`
 * Server Action, a POST). This defends the link against email scanners and inbox
 * preview prefetch, which issue passive GETs that would otherwise spend the token
 * before the admin clicks and surface a spurious "expired" state.
 */
export default async function AdminConfirmRecovery({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  // Serves both password recovery (003) and a new admin's invite (004).
  const linkPresent =
    Boolean(token_hash) && (type === "recovery" || type === "invite");

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
            {strings.resetTitle}
          </h1>

          {linkPresent ? (
            <form
              action={confirmPasswordReset}
              className="mt-8 flex flex-col gap-5"
            >
              <p className="text-center text-sm text-ink">
                {strings.confirmRecoveryPrompt}
              </p>
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <button
                type="submit"
                className="rounded-full bg-brand px-6 py-3.5 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {strings.confirmRecoveryLabel}
              </button>
            </form>
          ) : (
            <>
              <p
                role="alert"
                className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {strings.resetLinkInvalid}
              </p>
              <Link
                href="/admin/forgot-password"
                className="mt-5 block text-center text-sm font-semibold text-brand hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded-sm"
              >
                {strings.requestNewLinkLabel}
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
