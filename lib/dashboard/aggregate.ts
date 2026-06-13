/**
 * Pure aggregation for the admin analytics dashboard (feature 013). Turns the raw
 * rows the page RSC fetched (`RawDashboardData`) into the rendered `DashboardModel`
 * — totals, per-wave breakdown, chart series, engagement/content insights. No
 * Supabase import, no I/O → deterministically unit-tested.
 *
 * Points reuse `computeTotal`/`POINTS_EPOCH` from lib/points/total.ts exactly as
 * the student dashboard does, so the admin total + leaderboard agree with each
 * student's own total and an admin rule edit recomputes both (research R4).
 */
import { POINTS_EPOCH, computeTotal, type PointRules } from "@/lib/points/total";
import { attendanceRate, submissionRate, average } from "./rates";
import type {
  DashboardModel,
  RawDashboardData,
  LeaderboardEntry,
  WaveStat,
  WaveStatus,
} from "./types";

const DEFAULT_LEADERBOARD_LIMIT = 10;
const STATUS_ORDER: WaveStatus[] = ["not_started", "in_progress", "completed"];

/** Read the three rule values out of the point_rules rows (missing → 0). */
function readRules(rows: { action: string; points: number }[]): PointRules {
  const rules: PointRules = { attendance: 0, assignment: 0, feedback: 0 };
  for (const r of rows) {
    if (r.action in rules) rules[r.action as keyof PointRules] = r.points;
  }
  return rules;
}

/** Count occurrences of a key across rows, keyed by `student_id`. */
function countByStudent(rows: { student_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.student_id, (m.get(r.student_id) ?? 0) + 1);
  return m;
}

export function buildDashboardModel(data: RawDashboardData): DashboardModel {
  const {
    waves,
    students,
    instructorCount,
    weekCount,
    materialCount,
    videoCount,
    assignments,
    submissions,
    attendance,
    feedback,
    rules: ruleRows,
    leaderboardLimit = DEFAULT_LEADERBOARD_LIMIT,
  } = data;

  const rules = readRules(ruleRows);

  // ---- Overview totals (US1) ----
  const waveByType = { online: 0, offline: 0 };
  for (const w of waves) waveByType[w.type] += 1;

  const memberTotal = students.length;

  // Members present at least once, program-wide (distinct student_ids).
  const presentStudents = new Set(attendance.map((a) => a.student_id));
  const overallAttendanceRate = attendanceRate(
    countDistinctInScope(presentStudents, students, null),
    memberTotal
  );

  // ---- Per-member point counts (drive total points + leaderboard) ----
  const attendanceByStudent = countByStudent(attendance);
  const feedbackByStudent = countByStudent(feedback);
  // Only post-epoch submissions count toward points (research R6 / lib/points).
  const pointSubmissions = submissions.filter(
    (s) => s.submitted_at >= POINTS_EPOCH
  );
  const pointSubmissionByStudent = countByStudent(pointSubmissions);

  let totalPoints = 0;
  const leaderboard: LeaderboardEntry[] = [];
  for (const s of students) {
    const points = computeTotal(
      {
        attendance: attendanceByStudent.get(s.id) ?? 0,
        assignment: pointSubmissionByStudent.get(s.id) ?? 0,
        feedback: feedbackByStudent.get(s.id) ?? 0,
      },
      rules
    );
    totalPoints += points;
    if (points > 0) {
      leaderboard.push({ studentId: s.id, name: s.full_name, points });
    }
  }
  leaderboard.sort((a, b) => b.points - a.points);
  const topLeaderboard = leaderboard.slice(0, leaderboardLimit);

  // ---- Per-wave breakdown (US2) ----
  const membersByWave = groupCount(students, (s) => s.tenant_id); // null skipped
  const assignmentsByWave = groupCount(assignments, (a) => a.tenant_id);
  const submissionsByWave = groupCount(submissions, (s) => s.tenant_id);
  const presentByWave = groupDistinctStudents(attendance);
  const ratingsByWave = groupRatings(feedback);

  const waveStats: WaveStat[] = waves.map((w) => {
    const memberCount = membersByWave.get(w.id) ?? 0;
    const assignmentCount = assignmentsByWave.get(w.id) ?? 0;
    const r = ratingsByWave.get(w.id);
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      status: w.status,
      memberCount,
      attendanceRate: attendanceRate(presentByWave.get(w.id)?.size ?? 0, memberCount),
      submissionRate: submissionRate(
        submissionsByWave.get(w.id) ?? 0,
        memberCount * assignmentCount
      ),
      avgRating: r ? average(r.sum, r.count) : null,
    };
  });

  // ---- Charts (US3) ----
  const statusCounts = new Map<WaveStatus, number>();
  for (const w of waves) statusCounts.set(w.status, (statusCounts.get(w.status) ?? 0) + 1);

  // ---- Engagement & content (US4) ----
  const submissionsTotal = submissions.length;
  const expectedTotal = waveStats.reduce(
    (sum, w) => sum + w.memberCount * (assignmentsByWave.get(w.id) ?? 0),
    0
  );
  const sessionAgg = sumRatings(feedback, "session_rating");
  const instructorAgg = sumRatings(feedback, "instructor_rating");

  return {
    waveTotal: waves.length,
    waveByType,
    memberTotal,
    instructorTotal: instructorCount,
    overallAttendanceRate,
    totalPoints,

    waves: waveStats,

    charts: {
      typeSplit: [
        { label: "online", value: waveByType.online },
        { label: "offline", value: waveByType.offline },
      ],
      statusSplit: STATUS_ORDER.map((status) => ({
        label: status,
        value: statusCounts.get(status) ?? 0,
      })),
      membersPerWave: waveStats.map((w) => ({ label: w.name, value: w.memberCount })),
      leaderboard: topLeaderboard,
    },

    engagement: {
      submissionsTotal,
      overallSubmissionRate: submissionRate(submissionsTotal, expectedTotal),
      avgSessionRating: average(sessionAgg.sum, sessionAgg.count),
      avgInstructorRating: average(instructorAgg.sum, instructorAgg.count),
      feedbackResponses: feedback.length,
    },
    content: {
      weeks: weekCount,
      materials: materialCount,
      videos: videoCount,
      assignments: assignments.length,
    },
  };
}

// ---- helpers ----

/** Distinct students-in-scope present (scope: tenant_id, or null = program-wide). */
function countDistinctInScope(
  presentStudents: Set<string>,
  students: { id: string; tenant_id: string | null }[],
  tenantId: string | null
): number {
  if (tenantId === null) return presentStudents.size;
  let n = 0;
  for (const s of students) {
    if (s.tenant_id === tenantId && presentStudents.has(s.id)) n += 1;
  }
  return n;
}

/** Count rows grouped by a key getter; rows whose key is null/empty are skipped. */
function groupCount<T>(rows: T[], key: (row: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Per-tenant set of distinct present student_ids. */
function groupDistinctStudents(
  rows: { student_id: string; tenant_id: string }[]
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = m.get(r.tenant_id);
    if (!set) {
      set = new Set();
      m.set(r.tenant_id, set);
    }
    set.add(r.student_id);
  }
  return m;
}

/** Per-tenant running sum/count of all non-null session+instructor ratings. */
function groupRatings(
  rows: {
    tenant_id: string;
    session_rating: number | null;
    instructor_rating: number | null;
  }[]
): Map<string, { sum: number; count: number }> {
  const m = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    let acc = m.get(r.tenant_id);
    if (!acc) {
      acc = { sum: 0, count: 0 };
      m.set(r.tenant_id, acc);
    }
    for (const v of [r.session_rating, r.instructor_rating]) {
      if (v != null) {
        acc.sum += v;
        acc.count += 1;
      }
    }
  }
  return m;
}

/** Sum/count of one non-null rating column across all feedback. */
function sumRatings(
  rows: { session_rating: number | null; instructor_rating: number | null }[],
  col: "session_rating" | "instructor_rating"
): { sum: number; count: number } {
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    const v = r[col];
    if (v != null) {
      sum += v;
      count += 1;
    }
  }
  return { sum, count };
}
