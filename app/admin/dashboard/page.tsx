import DashboardShell from "@/components/DashboardShell";
import AdminSidebarFooter from "@/components/AdminSidebarFooter";
import StatCard from "@/components/dashboard/StatCard";
import StatCardGrid from "@/components/dashboard/StatCardGrid";
import PerWaveTable from "@/components/dashboard/PerWaveTable";
import DonutChart from "@/components/dashboard/DonutChart";
import BarChart from "@/components/dashboard/BarChart";
import PointsLeaderboard from "@/components/dashboard/PointsLeaderboard";
import InsightPanel from "@/components/dashboard/InsightPanel";
import strings from "@/lib/strings";
import { adminNavItems } from "@/lib/adminNav";
import { createClient } from "@/lib/supabase/server";
import { buildDashboardModel } from "@/lib/dashboard/aggregate";
import { formatPercent, formatRating } from "@/lib/dashboard/format";
import type {
  RawDashboardData,
  WaveLite,
  StudentLite,
  SubmissionLite,
  ActivityLite,
  FeedbackLite,
  RuleLite,
} from "@/lib/dashboard/types";

// Brand-consistent chart palettes (research R7): brand + the wave status-tag
// family. SVG fills need real color values, so these are the token hex literals.
const TYPE_COLORS = ["#1B5BFF", "#94A3B8"]; // online (brand), offline (slate-400)
const STATUS_COLORS = ["#64748B", "#D97706", "#059669"]; // not_started, in_progress, completed

function IconWaves() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1" />
    </svg>
  );
}
function IconMembers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    </svg>
  );
}
function IconInstructors() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}
function IconAttendance() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
    </svg>
  );
}
function IconPoints() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6" />
      <path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </h2>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { data: { user } },
    wavesRes,
    studentsRes,
    instructorsRes,
    weeksRes,
    materialsRes,
    videosRes,
    assignmentsRes,
    submissionsRes,
    attendanceRes,
    feedbackRes,
    rulesRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("tenants").select("id, name, type, status"),
    supabase.from("students").select("id, tenant_id, full_name"),
    supabase.from("instructors").select("id", { count: "exact", head: true }),
    supabase.from("wave_weeks").select("id", { count: "exact", head: true }),
    supabase.from("wave_materials").select("id", { count: "exact", head: true }),
    supabase.from("wave_videos").select("id", { count: "exact", head: true }),
    supabase.from("wave_assignments").select("tenant_id"),
    supabase.from("wave_submissions").select("student_id, tenant_id, submitted_at"),
    supabase.from("wave_attendance").select("student_id, tenant_id"),
    supabase.from("wave_feedback").select("student_id, tenant_id, session_rating, instructor_rating"),
    supabase.from("point_rules").select("action, points"),
  ]);

  const raw: RawDashboardData = {
    waves: (wavesRes.data ?? []) as WaveLite[],
    students: (studentsRes.data ?? []) as StudentLite[],
    instructorCount: instructorsRes.count ?? 0,
    weekCount: weeksRes.count ?? 0,
    materialCount: materialsRes.count ?? 0,
    videoCount: videosRes.count ?? 0,
    assignments: (assignmentsRes.data ?? []) as { tenant_id: string }[],
    submissions: (submissionsRes.data ?? []) as SubmissionLite[],
    attendance: (attendanceRes.data ?? []) as ActivityLite[],
    feedback: (feedbackRes.data ?? []) as FeedbackLite[],
    rules: (rulesRes.data ?? []) as RuleLite[],
  };

  const model = buildDashboardModel(raw);
  const e = model.engagement;
  const c = model.content;

  return (
    <DashboardShell
      panelName={strings.adminPanelName}
      navItems={adminNavItems}
      activeHref="/admin/dashboard"
      footer={<AdminSidebarFooter email={user?.email ?? ""} />}
    >
      <div className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-ink">{strings.dashboardLabel}</h1>
        <p className="mt-1 text-sm text-slate-500">{strings.adminDashboardSubtitle}</p>

        {/* US1 — Overview KPIs */}
        <SectionHeading>{strings.dashboardOverviewHeading}</SectionHeading>
        <div className="mt-4">
          <StatCardGrid>
            <StatCard
              label={strings.kpiWavesLabel}
              value={model.waveTotal}
              icon={<IconWaves />}
              sublabel={`${model.waveByType.online} ${strings.kpiOnlineLabel} · ${model.waveByType.offline} ${strings.kpiOfflineLabel}`}
            />
            <StatCard label={strings.kpiMembersLabel} value={model.memberTotal} icon={<IconMembers />} />
            <StatCard label={strings.kpiInstructorsLabel} value={model.instructorTotal} icon={<IconInstructors />} />
            <StatCard label={strings.kpiAttendanceRateLabel} value={formatPercent(model.overallAttendanceRate)} icon={<IconAttendance />} />
            <StatCard label={strings.kpiTotalPointsLabel} value={model.totalPoints} icon={<IconPoints />} />
          </StatCardGrid>
        </div>

        {/* US2 — Per-wave breakdown */}
        <SectionHeading>{strings.dashboardPerWaveHeading}</SectionHeading>
        <PerWaveTable waves={model.waves} />

        {/* US3 — Charts */}
        <SectionHeading>{strings.dashboardChartsHeading}</SectionHeading>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DonutChart title={strings.chartTypeSplitTitle} data={model.charts.typeSplit} colors={TYPE_COLORS} emptyLabel={strings.chartEmptyNote} />
          <DonutChart title={strings.chartStatusSplitTitle} data={model.charts.statusSplit} colors={STATUS_COLORS} emptyLabel={strings.chartEmptyNote} />
          <BarChart title={strings.chartMembersPerWaveTitle} data={model.charts.membersPerWave} emptyLabel={strings.chartEmptyNote} />
          <PointsLeaderboard title={strings.chartLeaderboardTitle} entries={model.charts.leaderboard} emptyLabel={strings.chartEmptyNote} />
        </div>

        {/* US4 — Engagement & content insights */}
        <SectionHeading>{strings.dashboardInsightsHeading}</SectionHeading>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InsightPanel
            title={strings.insightEngagementTitle}
            items={[
              { label: strings.insightSubmissionsLabel, value: String(e.submissionsTotal), icon: <IconDoc /> },
              { label: strings.insightSubmissionRateLabel, value: formatPercent(e.overallSubmissionRate), icon: <IconDoc /> },
              {
                label: strings.insightAvgSessionRatingLabel,
                value:
                  e.avgSessionRating == null
                    ? strings.insightFeedbackNoResponses
                    : `${formatRating(e.avgSessionRating)} ${strings.insightRatingScale}`,
                icon: <IconPoints />,
              },
              {
                label: strings.insightAvgInstructorRatingLabel,
                value:
                  e.avgInstructorRating == null
                    ? strings.insightFeedbackNoResponses
                    : `${formatRating(e.avgInstructorRating)} ${strings.insightRatingScale}`,
                icon: <IconInstructors />,
              },
              { label: strings.insightFeedbackResponsesLabel, value: String(e.feedbackResponses), icon: <IconDoc /> },
            ]}
          />
          <InsightPanel
            title={strings.insightContentTitle}
            items={[
              { label: strings.insightWeeksLabel, value: String(c.weeks), icon: <IconDoc /> },
              { label: strings.insightMaterialsLabel, value: String(c.materials), icon: <IconDoc /> },
              { label: strings.insightVideosLabel, value: String(c.videos), icon: <IconDoc /> },
              { label: strings.insightAssignmentsLabel, value: String(c.assignments), icon: <IconDoc /> },
            ]}
          />
        </div>
      </div>
    </DashboardShell>
  );
}
