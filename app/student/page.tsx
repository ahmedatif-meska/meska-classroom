import Logo from "@/components/Logo";
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
        {strings.welcomeSubtitle}
      </p>

      <form className="mt-8 flex flex-col gap-5" action="/student/dashboard">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="studentId"
            className="text-xs font-bold uppercase tracking-wide text-slate-700"
          >
            {strings.studentIdLabel}
          </label>
          <input
            id="studentId"
            name="studentId"
            type="text"
            placeholder={strings.studentIdPlaceholder}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="studentPassword"
            className="text-xs font-bold uppercase tracking-wide text-slate-700"
          >
            {strings.passwordLabel}
          </label>
          <input
            id="studentPassword"
            name="studentPassword"
            type="password"
            autoComplete="current-password"
            placeholder={strings.passwordPlaceholder}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>

        <button
          type="submit"
          className="mt-2 rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {strings.joinSessionLabel}
        </button>
      </form>
    </div>
    </main>
  );
}
