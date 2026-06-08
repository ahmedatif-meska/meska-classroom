import { notFound } from "next/navigation";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import EditWaveModal from "@/components/EditWaveModal";
import RemoveWaveDialog from "@/components/RemoveWaveDialog";
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

  const typeLabel =
    typed.type === "online" ? strings.waveTypeOnline : strings.waveTypeOffline;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/waves"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <Link
          href="/admin/waves"
          className="text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ← {strings.wavesTitle}
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-ink">{typed.name}</h1>
              <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                {typeLabel}
              </span>
            </div>
            {typed.description_html ? (
              <div
                className="instructor-rte mt-3 text-sm text-ink"
                dangerouslySetInnerHTML={{ __html: typed.description_html }}
              />
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                {strings.waveNoDescription}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
            <EditWaveModal wave={typed} />
            <RemoveWaveDialog waveId={typed.id} />
          </div>
        </div>

        <WaveWeeks waveId={typed.id} weeks={weeks} />
      </div>
    </DashboardShell>
  );
}
