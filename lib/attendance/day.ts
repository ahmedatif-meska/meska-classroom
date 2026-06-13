/**
 * The attendance "calendar day" (feature 012, FR-028) is evaluated in ONE fixed
 * business timezone so the once-per-day rule is deterministic regardless of the
 * scanning device or server region (research R3). Pure — unit-tested at the
 * midnight boundary in both DST offsets.
 */

export const ATTENDANCE_TZ = "Africa/Cairo";

/** Returns the local business-day date (`YYYY-MM-DD`) for an instant. */
export function attendanceDay(d: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
