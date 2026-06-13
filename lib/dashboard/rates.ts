/**
 * Pure rate/average helpers for the dashboard (feature 013). Every one guards a
 * zero (or negative) denominator and returns `null` — the dashboard renders that
 * as "—". They can NEVER produce NaN/Infinity (FR-005, FR-009, SC-006). Unit-tested.
 */
import type { RateValue } from "./types";

/** A fraction in [0,1]: members present ÷ total members. No members → null. */
export function attendanceRate(present: number, total: number): RateValue {
  if (total <= 0) return null;
  return present / total;
}

/** A fraction in [0,1]: submissions received ÷ expected. No denominator → null. */
export function submissionRate(received: number, expected: number): RateValue {
  if (expected <= 0) return null;
  return received / expected;
}

/** Mean of a summed value over a count. count ≤ 0 → null. */
export function average(sum: number, count: number): RateValue {
  if (count <= 0) return null;
  return sum / count;
}
