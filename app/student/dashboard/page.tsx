import DashboardShell from "@/components/DashboardShell";
import strings from "@/lib/strings";

export default function StudentDashboard() {
  return (
    <DashboardShell panelName={strings.studentPanelName}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-ink">{strings.dashboardLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {strings.studentDashboardSubtitle}
        </p>

        <div className="mt-10 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-surface py-24 text-sm text-slate-400">
          {strings.dashboardEmptyNote}
        </div>
      </div>
    </DashboardShell>
  );
}
