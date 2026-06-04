import Logo from "@/components/Logo";
import StudentLoginForm from "@/components/StudentLoginForm";
import strings from "@/lib/strings";

export default function StudentHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-sm sm:p-10">
        <div className="flex justify-center">
          <Logo homeHref="/student" />
        </div>

        <h1 className="mt-6 text-center text-xl font-bold text-ink">
          {strings.welcomeTitle}
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {strings.studentSignInSubtitle}
        </p>

        <StudentLoginForm />
      </div>
    </main>
  );
}
