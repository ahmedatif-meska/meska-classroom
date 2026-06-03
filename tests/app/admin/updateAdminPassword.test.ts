import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

let currentUser: { app_metadata?: Record<string, unknown>; email?: string } | null =
  null;
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const updateUser = vi.fn(
  async (): Promise<{ data: object; error: { message: string } | null }> => ({
    data: {},
    error: null,
  })
);
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const profileEq = vi.fn(async () => ({ error: null }));
const profileUpdate = vi.fn(() => ({ eq: profileEq }));
const from = vi.fn(() => ({ update: profileUpdate }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, updateUser, signOut },
    from,
    rpc,
  })),
}));

import { updateAdminPassword } from "@/app/admin/actions";

function form(password: string | null, confirm: string | null) {
  const fd = new FormData();
  if (password !== null) fd.set("password", password);
  if (confirm !== null) fd.set("confirm", confirm);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = {
    app_metadata: { role: "admin" },
    email: "admin@example.com",
  };
  updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("updateAdminPassword (US2.1)", () => {
  it("rejects when there is no valid admin recovery session (FR-010)", async () => {
    currentUser = null;
    const result = await updateAdminPassword({}, form("longenough1", "longenough1"));
    expect(result).toEqual({ error: strings.resetLinkInvalid });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a non-admin recovery session", async () => {
    currentUser = { app_metadata: { role: "student" }, email: "s@example.com" };
    const result = await updateAdminPassword({}, form("longenough1", "longenough1"));
    expect(result).toEqual({ error: strings.resetLinkInvalid });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("blocks a short/mismatched password BEFORE updateUser (SC-006)", async () => {
    const short = await updateAdminPassword({}, form("short7!", "short7!"));
    expect(short).toEqual({ error: strings.resetPasswordTooShort });

    const mismatch = await updateAdminPassword({}, form("longenough1", "longenough2"));
    expect(mismatch).toEqual({ error: strings.resetPasswordMismatch });

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("applies the password, revokes ALL sessions, then redirects (SC-005 / SC-007 / FR-013)", async () => {
    await expect(
      updateAdminPassword({}, form("longenough1", "longenough1"))
    ).rejects.toThrow("REDIRECT:/admin");
    expect(updateUser).toHaveBeenCalledWith({ password: "longenough1" });
    // An invited admin completing setup becomes active (idempotent for recovery).
    expect(profileUpdate).toHaveBeenCalledWith({ status: "active" });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "admin@example.com",
      p_outcome: "success",
      p_reason: "reset_done",
    });
  });

  it("returns a clear error when updateUser fails, without redirecting", async () => {
    updateUser.mockResolvedValue({ data: {}, error: { message: "weak" } });
    const result = await updateAdminPassword({}, form("longenough1", "longenough1"));
    expect(result).toEqual({ error: strings.resetUpdateFailed });
    expect(signOut).not.toHaveBeenCalled();
  });
});
