import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

/** US4 — updatePointRule: admin-gated, non-negative-integer validation. */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors/log", () => ({ logError: vi.fn(async () => {}) }));

let isAdmin = true;
vi.mock("@/lib/auth/adminGate", () => ({
  assertAdminSession: vi.fn(() =>
    isAdmin ? { ok: true } : { ok: false, reason: "not_admin" }
  ),
}));

const eq = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", app_metadata: { role: "admin" } } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import { updatePointRule } from "@/app/admin/points/actions";

function form(action: string | null, points: string | null) {
  const fd = new FormData();
  if (action !== null) fd.set("action", action);
  if (points !== null) fd.set("points", points);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin = true;
});

describe("updatePointRule (US4)", () => {
  it("denies a non-admin with no write", async () => {
    isAdmin = false;
    const result = await updatePointRule({}, form("attendance", "15"));
    expect(result).toEqual({ error: strings.pointsForbidden });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an unknown action", async () => {
    const result = await updatePointRule({}, form("bonus", "15"));
    expect(result).toEqual({ error: strings.pointsInvalid });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["negative", "-1"],
    ["blank", ""],
    ["non-numeric", "abc"],
    ["fractional", "12.5"],
  ])("rejects a %s value with the prior value kept (FR-021)", async (_label, value) => {
    const result = await updatePointRule({}, form("assignment", value));
    expect(result).toEqual({ error: strings.pointsInvalid });
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts zero (an action may grant nothing, edge case)", async () => {
    const result = await updatePointRule({}, form("feedback", "0"));
    expect(result).toEqual({ saved: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ points: 0 })
    );
  });

  it("persists a valid non-negative integer for the targeted action (FR-020)", async () => {
    const result = await updatePointRule({}, form("assignment", "25"));
    expect(result).toEqual({ saved: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ points: 25 })
    );
    expect(eq).toHaveBeenCalledWith("action", "assignment");
  });
});
