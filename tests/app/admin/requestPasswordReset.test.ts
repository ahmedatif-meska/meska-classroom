import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

// The Supabase server client is mocked per-test via these handles.
let isAdminValue = false;
const resetPasswordForEmail = vi.fn<
  (email: string, opts?: { redirectTo?: string }) => Promise<{ data: object; error: null }>
>(async () => ({ data: {}, error: null }));
const rpc = vi.fn(async (fn: string) => {
  if (fn === "is_admin_email") return { data: isAdminValue, error: null };
  return { data: null, error: null };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail },
    rpc,
  })),
}));

import { requestPasswordReset } from "@/app/admin/actions";

function form(email: string | null) {
  const fd = new FormData();
  if (email !== null) fd.set("email", email);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isAdminValue = false;
});

describe("requestPasswordReset (US1.1 / US3.1)", () => {
  it("blocks an empty email BEFORE any backend call (FR-002)", async () => {
    const result = await requestPasswordReset({}, form(""));
    expect(result).toEqual({ error: strings.forgotEmailRequired });
    expect(rpc).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a reset link for an administrator's email (US1.1)", async () => {
    isAdminValue = true;
    const result = await requestPasswordReset({}, form("ADMIN@example.com"));
    // email normalized to lower-case before the gate + send
    expect(rpc).toHaveBeenCalledWith("is_admin_email", {
      p_email: "admin@example.com",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledOnce();
    expect(resetPasswordForEmail.mock.calls[0][0]).toBe("admin@example.com");
    expect(result).toEqual({ sent: true });
  });

  it("does NOT send a link for a non-admin/unknown email (FR-003)", async () => {
    isAdminValue = false;
    const result = await requestPasswordReset({}, form("student@example.com"));
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true });
  });

  it("returns the IDENTICAL neutral state for admin and non-admin (no enumeration, SC-002)", async () => {
    isAdminValue = true;
    const adminState = await requestPasswordReset({}, form("admin@example.com"));
    isAdminValue = false;
    const otherState = await requestPasswordReset({}, form("nobody@example.com"));
    expect(adminState).toEqual(otherState);
  });

  it("records a reset_requested audit event in every accepted case (FR-015)", async () => {
    isAdminValue = true;
    await requestPasswordReset({}, form("admin@example.com"));
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "admin@example.com",
      p_outcome: "success",
      p_reason: "reset_requested",
    });

    vi.clearAllMocks();
    isAdminValue = false;
    await requestPasswordReset({}, form("nobody@example.com"));
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "nobody@example.com",
      p_outcome: "denied",
      p_reason: "reset_requested",
    });
  });
});
