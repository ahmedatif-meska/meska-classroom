import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

/**
 * US5 — submitFeedback: student-gated, week-in-own-wave verified (the
 * foreign-week farming case), one row per (week, student) via upsert,
 * returns the CURRENT feedback point value for the thank-you popup.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/errors/log", () => ({ logError: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> } | null;
let currentUser: User = null;
let studentRow: { id: string } | null = null;
let weekRow: { id: string } | null = null;
let feedbackPoints = 30;
let upsertError: { message: string } | null = null;

const upsert = vi.fn(async () => ({ error: upsertError }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

function from(table: string) {
  if (table === "students") {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: studentRow }) }),
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
  if (table === "wave_feedback") {
    return { upsert };
  }
  if (table === "point_rules") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { points: feedbackPoints } }),
        }),
      }),
    };
  }
  throw new Error(`unexpected table ${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import { submitFeedback } from "@/app/student/actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = {
    id: "member-id",
    app_metadata: { role: "student", tenant_id: "wave-1" },
  };
  studentRow = { id: "stu-1" };
  weekRow = { id: "wk-1" };
  feedbackPoints = 30;
  upsertError = null;
});

describe("submitFeedback (US5)", () => {
  it("denies a non-student session with no write", async () => {
    currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
    const result = await submitFeedback({}, form({ week_id: "wk-1" }));
    expect(result).toEqual({ error: strings.studentForbidden });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("requires a week id", async () => {
    const result = await submitFeedback({}, form({}));
    expect(result).toEqual({ error: strings.studentFeedbackFailed });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a week not in the caller's own wave (foreign-week farming, Principle VI)", async () => {
    // Own-tenant session, but the week lookup (RLS + explicit tenant filter)
    // resolves nothing — another wave's week id can never earn points.
    weekRow = null;
    const result = await submitFeedback(
      {},
      form({ week_id: "other-wave-week" })
    );
    expect(result).toEqual({ error: strings.studentForbidden });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the caller's own feedback and returns the current feedback points", async () => {
    const result = await submitFeedback(
      {},
      form({
        week_id: "wk-1",
        session_rating: "5",
        instructor_rating: "4",
        comment: "Great week!",
      })
    );
    expect(result).toEqual({ saved: true, awardedPoints: 30 });
    expect(upsert).toHaveBeenCalledOnce();
    const [row, opts] = upsert.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(row).toMatchObject({
      tenant_id: "wave-1",
      week_id: "wk-1",
      student_id: "stu-1",
      session_rating: 5,
      instructor_rating: 4,
      comment: "Great week!",
    });
    // One row per (week, student) — a resubmission UPDATES, never duplicates.
    expect(opts).toEqual({ onConflict: "week_id,student_id" });
  });

  it("bounds out-of-range ratings to null instead of writing junk", async () => {
    await submitFeedback(
      {},
      form({ week_id: "wk-1", session_rating: "9", comment: "x" })
    );
    const [row] = upsert.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(row.session_rating).toBeNull();
  });

  it("reflects an edited rule value in the award (FR-029)", async () => {
    feedbackPoints = 40;
    const result = await submitFeedback(
      {},
      form({ week_id: "wk-1", session_rating: "5" })
    );
    expect(result).toEqual({ saved: true, awardedPoints: 40 });
  });
});
