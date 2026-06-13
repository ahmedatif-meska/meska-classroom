import { describe, it, expect } from "vitest";
import { ATTENDANCE_TZ, attendanceDay } from "@/lib/attendance/day";

describe("attendanceDay (US2 — fixed business-timezone calendar day)", () => {
  it("uses the documented fixed timezone", () => {
    expect(ATTENDANCE_TZ).toBe("Africa/Cairo");
  });

  it("returns YYYY-MM-DD for a mid-day instant", () => {
    expect(attendanceDay(new Date("2026-06-12T10:00:00Z"))).toBe("2026-06-12");
  });

  it("a UTC instant just before local midnight stays on the local day (summer, UTC+3)", () => {
    // 20:59Z + 3h = 23:59 local — still June 12 in Cairo.
    expect(attendanceDay(new Date("2026-06-12T20:59:00Z"))).toBe("2026-06-12");
  });

  it("a UTC instant just after local midnight rolls to the next local day (summer, UTC+3)", () => {
    // 21:01Z + 3h = 00:01 local — already June 13 in Cairo.
    expect(attendanceDay(new Date("2026-06-12T21:01:00Z"))).toBe("2026-06-13");
  });

  it("handles the winter offset (UTC+2) at the boundary", () => {
    // 21:30Z + 2h = 23:30 local — still January 15.
    expect(attendanceDay(new Date("2026-01-15T21:30:00Z"))).toBe("2026-01-15");
    // 22:30Z + 2h = 00:30 local — already January 16.
    expect(attendanceDay(new Date("2026-01-15T22:30:00Z"))).toBe("2026-01-16");
  });
});
