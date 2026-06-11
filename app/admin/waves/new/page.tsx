import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import WaveBuilder from "@/components/WaveBuilder";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

export default async function NewWavePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; step?: string }>;
}) {
  const { from, step } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // When reached from the add-member flow, return there (re-opening the modal on
  // the step the admin left) on success; otherwise return to the Waves list.
  const fromMembers = from === "members";
  const redirectTo = fromMembers
    ? `/admin/members?add=${step === "bulk" ? "bulk" : "form"}`
    : "/admin/waves";
  const backHref = fromMembers ? "/admin/members" : "/admin/waves";
  const backLabel = fromMembers ? strings.membersTitle : strings.wavesTitle;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/waves"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="relative p-8">
        {/* Decorative ambient glow behind the form. */}
        <div
          className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -right-12 -top-24 h-[400px] w-[400px] rounded-full bg-brand opacity-10 blur-[100px]" />
          <div className="absolute -bottom-24 -left-12 h-[400px] w-[400px] rounded-full bg-brand opacity-10 blur-[100px]" />
        </div>

        <div className="relative z-10">
          <Link
            href={backHref}
            className="group inline-flex items-center gap-2 text-lg font-semibold text-brand transition-all hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <svg
              className="h-5 w-5 transition-transform group-hover:-translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {backLabel}
          </Link>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink">
            {strings.waveFormAddTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {strings.waveFormSubtitle}
          </p>

          {/* Both entry points (Waves tab and the add-member flow) use the same
              one-page builder. From the add-member flow we return to its form on
              Save so the new wave can be assigned right away. */}
          <div className="mt-8">
            <WaveBuilder redirectTo={redirectTo} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
