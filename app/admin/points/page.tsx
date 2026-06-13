import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import PointRulesTable, { type PointRule } from "@/components/PointRulesTable";
import type { PointAction } from "@/app/admin/points/actions";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import strings from "@/lib/strings";

/** Display order — mirrors the reward flow, not the alphabetical pk order. */
const DISPLAY_ORDER: PointAction[] = ["attendance", "assignment", "feedback"];

export default async function PointsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.from("point_rules").select("action, points");
  const byAction = new Map(
    ((data ?? []) as PointRule[]).map((r) => [r.action, r.points])
  );
  const rules: PointRule[] = DISPLAY_ORDER.filter((a) => byAction.has(a)).map(
    (action) => ({ action, points: byAction.get(action)! })
  );

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/points"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">{strings.pointsTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {strings.pointsSubtitle}
          </p>
        </div>

        {rules.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-surface py-16 text-center text-sm text-slate-400">
            {strings.dashboardEmptyNote}
          </div>
        ) : (
          <PointRulesTable rules={rules} />
        )}
      </div>
    </DashboardShell>
  );
}
