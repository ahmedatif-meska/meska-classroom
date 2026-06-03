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

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { confirmPasswordReset } from "@/app/admin/actions";

function fd(token: string, type: string) {
  const f = new FormData();
  f.set("token_hash", token);
  f.set("type", type);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { app_metadata: { role: "admin" }, email: "new@example.com" };
  verifyError = null;
});

describe("confirmPasswordReset (US3.1) — invite link", () => {
  it("verifies an invite token with type=invite and redirects to set-password (SC-004)", async () => {
    await expect(confirmPasswordReset(fd("inv", "invite"))).rejects.toThrow(
      "REDIRECT:/admin/reset-password"
    );
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "invite",
      token_hash: "inv",
    });
  });

  it("treats an expired/used invite link as invalid", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    await expect(confirmPasswordReset(fd("stale", "invite"))).rejects.toThrow(
      "error=link"
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "",
      p_outcome: "denied",
      p_reason: "reset_invalid",
    });
  });
});
