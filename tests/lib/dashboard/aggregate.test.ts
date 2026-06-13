import { describe, it, expect } from "vitest";
import { buildDashboardModel } from "@/lib/dashboard/aggregate";
import type { RawDashboardData } from "@/lib/dashboard/types";

// s2's submission is PRE the points epoch — it counts toward submission totals
// but NOT toward points (research R6).
const PRE_EPOCH = "2026-05-01T00:00:00Z";
const POST_EPOCH = "2026-06-15T00:00:00Z";

function fixture(): RawDashboardData {
  return {
    waves: [
      { id: "w1", name: "Wave A", type: "online", status: "in_progress" },
      { id: "w2", name: "Wave B", type: "offline", status: "completed" },
      { id: "w3", name: "Wave C", type: "online", status: "not_started" },
    ],
    students: [
      { id: "s1", tenant_id: "w1", full_name: "Alice" },
      { id: "s2", tenant_id: "w1", full_name: "Bob" },
      { id: "s3", tenant_id: "w2", full_name: "Cara" },
      { id: "s4", tenant_id: null, full_name: "Unassigned Una" },
    ],
    instructorCount: 8,
    weekCount: 4,
    materialCount: 12,
    videoCount: 6,
    assignments: [{ tenant_id: "w1" }, { tenant_id: "w1" }, { tenant_id: "w2" }],
    submissions: [
      { student_id: "s1", tenant_id: "w1", submitted_at: POST_EPOCH },
      { student_id: "s2", tenant_id: "w1", submitted_at: PRE_EPOCH },
      { student_id: "s3", tenant_id: "w2", submitted_at: POST_EPOCH },
    ],
    attendance: [
      { student_id: "s1", tenant_id: "w1" },
      { student_id: "s2", tenant_id: "w1" },
      { student_id: "s3", tenant_id: "w2" },
    ],
    feedback: [
      { student_id: "s1", tenant_id: "w1", session_rating: 5, instructor_rating: 3 },
      { student_id: "s3", tenant_id: "w2", session_rating: 4, instructor_rating: null },
    ],
    rules: [
      { action: "attendance", points: 10 },
      { action: "assignment", points: 20 },
      { action: "feedback", points: 30 },
    ],
  };
}

describe("buildDashboardModel — overview (US1)", () => {
  it("computes wave/member/instructor totals and online/offline split", () => {
    const m = buildDashboardModel(fixture());
    expect(m.waveTotal).toBe(3);
    expect(m.waveByType).toEqual({ online: 2, offline: 1 });
    expect(m.memberTotal).toBe(4);
    expect(m.instructorTotal).toBe(8);
  });

  it("overall attendance rate = distinct present ÷ total members", () => {
    const m = buildDashboardModel(fixture());
    expect(m.overallAttendanceRate).toBe(0.75); // 3 of 4 members attended
  });

  it("total points = Σ per-member counts × rules, excluding pre-epoch submissions", () => {
    const m = buildDashboardModel(fixture());
    // s1: 10+20+30=60, s2: 10 (pre-epoch submission excluded), s3: 60, s4: 0
    expect(m.totalPoints).toBe(130);
  });
});

describe("buildDashboardModel — per-wave breakdown (US2)", () => {
  it("groups member counts (incl. assigned, excl. unassigned)", () => {
    const m = buildDashboardModel(fixture());
    const byId = Object.fromEntries(m.waves.map((w) => [w.id, w]));
    expect(byId.w1.memberCount).toBe(2);
    expect(byId.w2.memberCount).toBe(1);
    expect(byId.w3.memberCount).toBe(0);
  });

  it("computes per-wave attendance/submission/rating with the documented formulas", () => {
    const m = buildDashboardModel(fixture());
    const byId = Object.fromEntries(m.waves.map((w) => [w.id, w]));
    expect(byId.w1.attendanceRate).toBe(1); // 2 of 2 present
    expect(byId.w1.submissionRate).toBe(0.5); // 2 received / (2 members × 2 assignments)
    expect(byId.w1.avgRating).toBe(4); // (5+3)/2
    expect(byId.w2.submissionRate).toBe(1); // 1 / (1×1)
  });

  it("a wave with no members/activity yields null rates (rendered '—'), never NaN", () => {
    const m = buildDashboardModel(fixture());
    const w3 = m.waves.find((w) => w.id === "w3")!;
    expect(w3.attendanceRate).toBeNull();
    expect(w3.submissionRate).toBeNull();
    expect(w3.avgRating).toBeNull();
  });

  it("per-wave attendance rate uses the same formula as the overall rate (FR-019)", () => {
    // Single wave, 4 of 8 present → both forms must equal 0.5.
    const m = buildDashboardModel({
      ...fixture(),
      waves: [{ id: "x", name: "X", type: "online", status: "in_progress" }],
      students: Array.from({ length: 8 }, (_, i) => ({
        id: `p${i}`,
        tenant_id: "x",
        full_name: `P${i}`,
      })),
      attendance: [0, 1, 2, 3].map((i) => ({ student_id: `p${i}`, tenant_id: "x" })),
      submissions: [],
      feedback: [],
      assignments: [],
    });
    expect(m.overallAttendanceRate).toBe(0.5);
    expect(m.waves[0].attendanceRate).toBe(0.5);
  });
});

describe("buildDashboardModel — charts (US3)", () => {
  it("shapes type/status/members series and a descending capped leaderboard", () => {
    const m = buildDashboardModel(fixture());
    expect(m.charts.typeSplit).toEqual([
      { label: "online", value: 2 },
      { label: "offline", value: 1 },
    ]);
    expect(m.charts.statusSplit.map((d) => d.value)).toEqual([1, 1, 1]); // not_started, in_progress, completed
    expect(
      m.charts.membersPerWave.find((d) => d.label === "Wave A")?.value
    ).toBe(2);

    const lb = m.charts.leaderboard;
    expect(lb).toHaveLength(3); // s4 (0 points) excluded
    expect(lb[0].points).toBe(60);
    expect(lb[lb.length - 1].points).toBe(10);
    // descending
    expect(lb.every((e, i) => i === 0 || lb[i - 1].points >= e.points)).toBe(true);
  });

  it("respects the leaderboard limit", () => {
    const m = buildDashboardModel({ ...fixture(), leaderboardLimit: 1 });
    expect(m.charts.leaderboard).toHaveLength(1);
    expect(m.charts.leaderboard[0].points).toBe(60);
  });
});

describe("buildDashboardModel — engagement & content (US4)", () => {
  it("computes submission totals/rate, rating averages, and content counts", () => {
    const m = buildDashboardModel(fixture());
    expect(m.engagement.submissionsTotal).toBe(3);
    expect(m.engagement.overallSubmissionRate).toBe(0.6); // 3 / (4+1+0 expected)
    expect(m.engagement.avgSessionRating).toBe(4.5); // (5+4)/2
    expect(m.engagement.avgInstructorRating).toBe(3); // only s1's 3 is non-null
    expect(m.engagement.feedbackResponses).toBe(2);
    expect(m.content).toEqual({ weeks: 4, materials: 12, videos: 6, assignments: 3 });
  });
});

describe("buildDashboardModel — empty platform", () => {
  it("returns zeros and null rates with no NaN/throw", () => {
    const m = buildDashboardModel({
      waves: [],
      students: [],
      instructorCount: 0,
      weekCount: 0,
      materialCount: 0,
      videoCount: 0,
      assignments: [],
      submissions: [],
      attendance: [],
      feedback: [],
      rules: [],
    });
    expect(m.waveTotal).toBe(0);
    expect(m.memberTotal).toBe(0);
    expect(m.totalPoints).toBe(0);
    expect(m.overallAttendanceRate).toBeNull();
    expect(m.engagement.overallSubmissionRate).toBeNull();
    expect(m.engagement.avgSessionRating).toBeNull();
    expect(m.charts.leaderboard).toEqual([]);
    expect(m.waves).toEqual([]);
  });
});
