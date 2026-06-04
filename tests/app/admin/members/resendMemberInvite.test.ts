import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let target: { email: string; status: string } | null = null;

const maybeSingle = vi.fn(async () => ({ data: target, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

// The onboarding magic link is sent via an isolated anon client.
const signInWithOtp = vi.fn(async () => ({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithOtp } })),
}));

import { resendMemberInvite } from "@/app/admin/members/actions";

function form(id: string | null) {
  const fd = new FormData();
  if (id !== null) fd.set("target_id", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
  target = { email: "m@x.com", status: "pending" };
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("resendMemberInvite (US2.1)", () => {
  it("denies a non-admin caller", async () => {
    currentUser = null;
    const result = await resendMemberInvite({}, form("m1"));
    expect(result).toEqual({ error: strings.memberMgmtForbidden });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("refuses a non-pending (already active) member", async () => {
    target = { email: "m@x.com", status: "active" };
    const result = await resendMemberInvite({}, form("m1"));
    expect(result).toEqual({ error: strings.memberMgmtResendNotPending });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("re-sends the onboarding magic link to a pending member and audits member_reinvited (FR-026)", async () => {
    const result = await resendMemberInvite({}, form("m1"));
    expect(result).toEqual({ sent: true });
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "m@x.com",
        options: expect.objectContaining({
          shouldCreateUser: false,
          emailRedirectTo: expect.stringContaining("/student/auth/confirm"),
        }),
      })
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "m@x.com",
      p_outcome: "success",
      p_reason: "member_reinvited",
    });
  });
});
