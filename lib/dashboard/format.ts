/**
 * Presentation helpers shared by the dashboard components (feature 013). A null
 * RateValue (no denominator) renders as the shared "—" sentinel.
 */
import strings from "@/lib/strings";
import type { RateValue } from "./types";

/** A fraction (0..1) → "73%"; null → "—". */
export function formatPercent(v: RateValue): string {
  return v == null ? strings.rateNoData : `${Math.round(v * 100)}%`;
}

/** A 1..5 rating → "4.2"; null → "—". */
export function formatRating(v: RateValue): string {
  return v == null ? strings.rateNoData : v.toFixed(1);
}
