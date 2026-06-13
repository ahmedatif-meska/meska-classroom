/**
 * Derived gamification total (feature 012, US5). A student's points are always
 * their rewarded-action COUNTS × the CURRENT admin-configured rule values —
 * never a stored ledger — so editing a rule retroactively and consistently
 * recomputes every total (FR-029, research R5). Pure — unit-tested.
 */

/**
 * Only assignment submissions at/after this instant count toward points, so
 * every student starts at zero when the feature goes live even if they already
 * submitted assignments before it existed (FR-022, research R6). Attendance and
 * feedback need no epoch — their tables start empty.
 */
export const POINTS_EPOCH = "2026-06-12T00:00:00Z";

export type PointCounts = {
  attendance: number;
  assignment: number;
  feedback: number;
};

export type PointRules = {
  attendance: number;
  assignment: number;
  feedback: number;
};

export function computeTotal(counts: PointCounts, rules: PointRules): number {
  return (
    counts.attendance * rules.attendance +
    counts.assignment * rules.assignment +
    counts.feedback * rules.feedback
  );
}
