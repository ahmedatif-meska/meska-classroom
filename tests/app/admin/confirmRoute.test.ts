import { describe, it, expect, vi, beforeEach } from "vitest";

let currentUser: { app_metadata?: Record<string, unknown>; email?: string } | null =
  null;
let verifyError: { message: string } | null = null;
const verifyOtp = vi.fn(async () => ({ data: {}, error: verifyError }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp, getUser, signOut },
    rpc,
  })),
}));

// redirect() throws in Next; surface the target so we can assert on it.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { confirmPasswordReset } from "@/app/admin/actions";

function fd(token?: string) {
  const f = new FormData();
  if (token !== undefined) f.set("token_hash", token);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { app_metadata: { role: "admin" }, email: "admin@example.com" };
  verifyError = null;
});

describe("confirmPasswordReset (US4.1) — verify only on explicit click", () => {
  it("verifies a valid admin recovery token and redirects to the change-password page", async () => {
    await expect(confirmPasswordReset(fd("abc"))).rejects.toThrow(
      "REDIRECT:/admin/reset-password"
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "abc",
    });
  });

  it("redirects to the invalid-link state when the token is missing", async () => {
    await expect(confirmPasswordReset(fd())).rejects.toThrow(
      "REDIRECT:/admin/reset-password?error=link"
    );
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("redirects to the invalid-link state when verifyOtp fails (expired/used/tampered, SC-003)", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    await expect(confirmPasswordReset(fd("stale"))).rejects.toThrow("error=link");
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "",
      p_outcome: "denied",
      p_reason: "reset_invalid",
    });
  });

  it("signs out and rejects a non-admin recovery session (FR-010)", async () => {
    currentUser = { app_metadata: { role: "student" }, email: "s@example.com" };
    await expect(confirmPasswordReset(fd("abc"))).rejects.toThrow("error=link");
    expect(signOut).toHaveBeenCalledOnce();
  });
});
