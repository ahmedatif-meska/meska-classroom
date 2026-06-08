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
      <div className="p-8">
        <Link
          href={backHref}
          className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ← {backLabel}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-ink">
          {strings.waveFormAddTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {strings.waveFormSubtitle}
        </p>

        {/* Both entry points (Waves tab and the add-member flow) use the same
            one-page builder. From the add-member flow we return to its form on
            Save so the new wave can be assigned right away. */}
        <div className="mt-8">
          <WaveBuilder redirectTo={redirectTo} />
        </div>
      </div>
    </DashboardShell>
  );
}
