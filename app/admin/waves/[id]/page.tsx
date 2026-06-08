import { notFound } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import RemoveWaveDialog from "@/components/RemoveWaveDialog";
import WaveForm from "@/components/WaveForm";
import WaveWeeks from "@/components/WaveWeeks";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import { fetchWaveContent, type WaveRow } from "@/lib/waves/content";
import strings from "@/lib/strings";

export default async function WaveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: wave } = await supabase
    .from("tenants")
    .select("id, name, description_html, type, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!wave) notFound();
  const typed = wave as WaveRow;

  const weeks = await fetchWaveContent(supabase, id);

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/waves"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/admin/waves"
            className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ← {strings.wavesTitle}
          </Link>
          <RemoveWaveDialog waveId={typed.id} />
        </div>

        <h1 className="mt-4 text-2xl font-bold text-ink">
          {strings.waveFormEditTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{strings.waveFormSubtitle}</p>

        {/* The whole wave edits on one page: the basics edit inline here, and the
            weeks/materials/assignments are managed in the section below. */}
        <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-surface p-6 sm:p-8">
          <WaveForm wave={typed} />
        </div>

        <WaveWeeks waveId={typed.id} weeks={weeks} />
      </div>
    </DashboardShell>
  );
}
