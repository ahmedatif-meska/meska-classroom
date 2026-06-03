import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let targetRow: { email: string; status: string } | null = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const maybeSingle = vi.fn(async () => ({ data: targetRow, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, resetPasswordForEmail },
    from,
    rpc,
  })),
}));

import { resendInvite } from "@/app/admin/actions";

function form(targetId: string | null) {
  const fd = new FormData();
  if (targetId !== null) fd.set("target_id", targetId);
  fd.set("target_email", "pending@x.com");
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller-id", app_metadata: { role: "admin" } };
  targetRow = { email: "pending@x.com", status: "pending" };
  resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
});

describe("resendInvite (US2.2)", () => {
  it("denies a non-admin caller before any send (FR-017)", async () => {
    currentUser = null;
    const result = await resendInvite({}, form("target-id"));
    expect(result).toEqual({ error: strings.adminMgmtForbidden });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("rejects a non-pending (active) target (FR-020)", async () => {
    targetRow = { email: "active@x.com", status: "active" };
    const result = await resendInvite({}, form("target-id"));
    expect(result).toEqual({ error: strings.adminMgmtResendNotPending });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("re-sends a fresh set-password link and audits for a pending target (FR-020)", async () => {
    const result = await resendInvite({}, form("target-id"));
    expect(result).toEqual({ sent: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "pending@x.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/admin/auth/confirm"),
      })
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "pending@x.com",
      p_outcome: "success",
      p_reason: "admin_reinvited",
    });
  });

  it("reports a send failure", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: "smtp" },
    });
    const result = await resendInvite({}, form("target-id"));
    expect(result).toEqual({ error: strings.adminMgmtInviteFailed });
  });
});
