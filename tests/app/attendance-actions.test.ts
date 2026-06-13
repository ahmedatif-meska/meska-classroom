import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";
import { attendanceDay } from "@/lib/attendance/day";

/**
 * US2 — markAttendance (scan, offline-only, once per day) and
 * US3 — importOnlineAttendance (CSV, online-only, skip+report).
 * Wave isolation: FR-015 (method↔wave-type), FR-027 (own wave), FR-028 (per-day).
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors/log", () => ({ logError: vi.fn(async () => {}) }));

let isAdmin = true;
vi.mock("@/lib/auth/adminGate", () => ({
  assertAdminSession: vi.fn(() =>
    isAdmin ? { ok: true } : { ok: false, reason: "not_admin" }
  ),
}));

// ---- chainable Supabase mock, per-table state ----------------------------
type Row = Record<string, unknown> | null;
let waveRow: Row = null; // tenants lookup
let studentRow: Row = null; // students lookup (scan path)
let weekRow: Row = null; // wave_weeks lookup
let existingAttendance: Row = null; // pre-check lookup
let insertError: { code?: string; message: string } | null = null;
let waveStudents: Array<{ id: string; email: string }> = []; // CSV path
let attendedToday: string[] = []; // student ids already marked (CSV pre-check)

const insert = vi.fn(async () => ({ error: insertError }));
const insertCsv = vi.fn(async (row: { student_id: string }) => {
  if (attendedToday.includes(`race:${row.student_id}`)) {
    return { error: { code: "23505", message: "duplicate key" } };
  }
  return { error: null };
});

const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", app_metadata: { role: "admin" } } },
}));

function from(table: string) {
  if (table === "tenants") {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: waveRow }) }),
      }),
    };
  }
  if (table === "students") {
    return {
      select: () => ({
        // scan path: .eq("id", …).maybeSingle()
        eq: (col: string) =>
          col === "id"
            ? { maybeSingle: async () => ({ data: studentRow }) }
            : // CSV path: .eq("tenant_id", …).in("email", …)
              {
                in: async () => ({ data: waveStudents }),
              },
      }),
    };
  }
  if (table === "wave_weeks") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: weekRow }) }),
        }),
      }),
    };
  }
  if (table === "wave_attendance") {
    return {
      select: () => ({
        eq: (col: string, val: unknown) =>
          col === "student_id"
            ? {
                eq: () => ({
                  maybeSingle: async () => ({
                    data:
                      typeof val === "string" && attendedToday.includes(val)
                        ? { id: "existing" }
                        : existingAttendance,
                  }),
                }),
              }
            : {
                // CSV batch pre-check: .in("student_id", …).eq("attended_on", …)
                eq: async () => ({ data: [] }),
              },
        in: () => ({
          eq: async () => ({
            data: attendedToday
              .filter((s) => !s.startsWith("race:"))
              .map((s) => ({ student_id: s })),
          }),
        }),
      }),
      insert: (row: Record<string, unknown>) =>
        (row.method === "csv" ? insertCsv : insert)(
          row as { student_id: string }
        ),
    };
  }
  throw new Error(`unexpected table ${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import {
  markAttendance,
  importOnlineAttendance,
} from "@/app/admin/attendance/actions";

function scanForm(studentId: string, waveId: string, weekId: string) {
  const fd = new FormData();
  fd.set("student_id", studentId);
  fd.set("wave_id", waveId);
  fd.set("week_id", weekId);
  return fd;
}

function csvForm(waveId: string, weekId: string, emails: string[]) {
  const fd = new FormData();
  fd.set("wave_id", waveId);
  fd.set("week_id", weekId);
  fd.set("emails", JSON.stringify(emails));
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
  waveRow = { id: "wave-1", type: "offline" };
  studentRow = { id: "stu-1", tenant_id: "wave-1" };
  weekRow = { id: "week-1" };
  existingAttendance = null;
  insertError = null;
  waveStudents = [];
  attendedToday = [];
});

describe("markAttendance (US2)", () => {
  it("denies a non-admin with no write", async () => {
    isAdmin = false;
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ error: strings.attendanceForbidden });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a non-offline wave (scan is offline-only, FR-015)", async () => {
    waveRow = { id: "wave-1", type: "online" };
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ error: strings.attendanceWaveNotOffline });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a student not enrolled in the selected wave (FR-027)", async () => {
    studentRow = { id: "stu-1", tenant_id: "another-wave" };
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ error: strings.attendanceWrongWave });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns alreadyAttended when a record exists for today (FR-028)", async () => {
    existingAttendance = { id: "row-1" };
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ alreadyAttended: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it("maps a unique-violation insert (lost race) to alreadyAttended", async () => {
    insertError = { code: "23505", message: "duplicate key" };
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ alreadyAttended: true });
  });

  it("inserts a scan record for today's business day and returns marked", async () => {
    const result = await markAttendance({}, scanForm("stu-1", "wave-1", "week-1"));
    expect(result).toEqual({ marked: true });
    expect(insert).toHaveBeenCalledOnce();
    const row = insert.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      tenant_id: "wave-1",
      week_id: "week-1",
      student_id: "stu-1",
      method: "scan",
      attended_on: attendanceDay(new Date()),
    });
  });
});

describe("importOnlineAttendance (US3)", () => {
  beforeEach(() => {
    waveRow = { id: "wave-1", type: "online" };
    waveStudents = [
      { id: "stu-a", email: "a@example.com" },
      { id: "stu-b", email: "b@example.com" },
    ];
  });

  it("denies a non-admin with no write", async () => {
    isAdmin = false;
    const result = await importOnlineAttendance(
      {},
      csvForm("wave-1", "week-1", ["a@example.com"])
    );
    expect(result).toEqual({ error: strings.attendanceForbidden });
    expect(insertCsv).not.toHaveBeenCalled();
  });

  it("rejects a non-online wave (CSV is online-only, FR-015)", async () => {
    waveRow = { id: "wave-1", type: "offline" };
    const result = await importOnlineAttendance(
      {},
      csvForm("wave-1", "week-1", ["a@example.com"])
    );
    expect(result).toEqual({ error: strings.attendanceWaveNotOnline });
    expect(insertCsv).not.toHaveBeenCalled();
  });

  it("marks matches, skips+reports unmatched and already-today rows, never aborts (FR-016)", async () => {
    attendedToday = ["stu-b"];
    const result = await importOnlineAttendance(
      {},
      csvForm("wave-1", "week-1", [
        "a@example.com", // new → marked
        "b@example.com", // already today → skipped
        "ghost@example.com", // no member → skipped
      ])
    );
    expect(result).toEqual({
      marked: 1,
      skipped: [
        { email: "b@example.com", reason: "already" },
        { email: "ghost@example.com", reason: "unmatched" },
      ],
    });
    expect(insertCsv).toHaveBeenCalledOnce();
    const row = insertCsv.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ student_id: "stu-a", method: "csv" });
  });

  it("collapses in-file duplicates (one mark per member)", async () => {
    const result = await importOnlineAttendance(
      {},
      csvForm("wave-1", "week-1", [
        "a@example.com",
        "A@EXAMPLE.COM",
        "a@example.com",
      ])
    );
    expect(result).toEqual({ marked: 1, skipped: [] });
    expect(insertCsv).toHaveBeenCalledOnce();
  });

  it("maps a per-row unique-violation (lost race) to an already skip and continues", async () => {
    attendedToday = ["race:stu-a"]; // insert for stu-a hits 23505
    const result = await importOnlineAttendance(
      {},
      csvForm("wave-1", "week-1", ["a@example.com", "b@example.com"])
    );
    expect(result).toEqual({
      marked: 1,
      skipped: [{ email: "a@example.com", reason: "already" }],
    });
    expect(insertCsv).toHaveBeenCalledTimes(2);
  });
});
