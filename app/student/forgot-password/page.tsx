import Image from "next/image";
import BrandHeader from "@/components/BrandHeader";
import BrandMark from "@/components/BrandMark";
import StudentForgotPasswordForm from "@/components/StudentForgotPasswordForm";
import strings from "@/lib/strings";

/**
 * GET /student/forgot-password — member self-service recovery request (US1).
 * Mirrors the student sign-in card; the emailed link continues through the
 * existing /student/auth/confirm → /student/set-password flow.
 */
export default function StudentForgotPassword() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Full-bleed academic background (same as the sign-in page) */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <Image
          src="/screen_2.png"
          alt={strings.studentSignInBackgroundAlt}
          fill
          priority
          sizes="100vw"
          className="h-full w-full object-cover"
        />
      </div>

      <BrandHeader homeHref="/student" />

      <main className="z-10 flex w-full flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px] rounded-2xl border border-white/40 bg-surface/90 p-8 text-center shadow-xl backdrop-blur-xl sm:p-10">
          <div className="mb-6 flex items-center justify-center">
            <BrandMark className="h-16 w-16 text-brand" title={strings.logoAlt} />
          </div>

          <h1 className="mb-2 text-2xl font-bold text-ink md:text-3xl">
            {strings.studentForgotTitle}
          </h1>
          <p className="text-sm text-slate-500">
            {strings.studentForgotSubtitle}
          </p>

          <StudentForgotPasswordForm />
        </div>
      </main>
    </div>
  );
}
