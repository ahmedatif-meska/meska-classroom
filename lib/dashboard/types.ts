/**
 * View-model types for the admin analytics dashboard (feature 013). Everything
 * here is DERIVED, in-memory only — no table backs it. `lib/dashboard/aggregate.ts`
 * turns the raw rows the page RSC fetches (`RawDashboardData`) into a
 * `DashboardModel` the Server Components render. Pure + deterministic.
 */
import type { WaveStatus } from "@/lib/waves/validation";

export type { WaveStatus };

/** A rate/average that may have no denominator → rendered as "—" (never NaN). */
export type RateValue = number | null;

export type WaveType = "online" | "offline";

/** Minimal shapes of the rows the page reads (column-narrowed, see data-model.md). */
export type WaveLite = {
  id: string;
  name: string;
  type: WaveType;
  status: WaveStatus;
};
export type StudentLite = {
  id: string;
  tenant_id: string | null;
  full_name: string;
};
export type ActivityLite = { student_id: string; tenant_id: string };
export type SubmissionLite = {
  student_id: string;
  tenant_id: string;
  submitted_at: string;
};
export type FeedbackLite = {
  student_id: string;
  tenant_id: string;
  session_rating: number | null;
  instructor_rating: number | null;
};
export type RuleLite = { action: string; points: number };

/** The full input to `buildDashboardModel`. */
export type RawDashboardData = {
  waves: WaveLite[];
  students: StudentLite[];
  instructorCount: number;
  weekCount: number;
  materialCount: number;
  videoCount: number;
  assignments: { tenant_id: string }[];
  submissions: SubmissionLite[];
  attendance: ActivityLite[];
  feedback: FeedbackLite[];
  rules: RuleLite[];
  /** How many members the points leaderboard shows. */
  leaderboardLimit?: number;
};

export type ChartDatum = { label: string; value: number };
export type LeaderboardEntry = { studentId: string; name: string; points: number };

export type WaveStat = {
  id: string;
  name: string;
  type: WaveType;
  status: WaveStatus;
  memberCount: number;
  attendanceRate: RateValue;
  submissionRate: RateValue;
  avgRating: RateValue;
};

export type DashboardModel = {
  // Overview (US1)
  waveTotal: number;
  waveByType: { online: number; offline: number };
  memberTotal: number;
  instructorTotal: number;
  overallAttendanceRate: RateValue;
  totalPoints: number;

  // Per-wave breakdown (US2)
  waves: WaveStat[];

  // Charts (US3)
  charts: {
    typeSplit: ChartDatum[];
    statusSplit: ChartDatum[];
    membersPerWave: ChartDatum[];
    leaderboard: LeaderboardEntry[];
  };

  // Engagement & content insights (US4)
  engagement: {
    submissionsTotal: number;
    overallSubmissionRate: RateValue;
    avgSessionRating: RateValue;
    avgInstructorRating: RateValue;
    feedbackResponses: number;
  };
  content: {
    weeks: number;
    materials: number;
    videos: number;
    assignments: number;
  };
};
