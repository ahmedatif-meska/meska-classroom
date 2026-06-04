import { describe, it, expect, vi, beforeEach } from "vitest";

// Resulting session after the OTP attempt (what getUser returns).
let sessionUser: { app_metadata?: Record<string, unknown> } | null = null;
let verifyError: { message: string } | null = null;
const verifyOtp = vi.fn(async () => ({ data: {}, error: verifyError }));
const getUser = vi.fn(async () => ({ data: { user: sessionUser } }));
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp, getUser, signOut } })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { confirmStudentInvite } from "@/app/student/actions";

function fd(token: string | null, type = "email") {
  const f = new FormData();
  if (token !== null) f.set("token_hash", token);
  f.set("type", type);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionUser = { app_metadata: { role: "student" } };
  verifyError = null;
});

describe("confirmStudentInvite (member onboarding)", () => {
  it("verifies a fresh magic link and lands on set-password", async () => {
    await expect(confirmStudentInvite(fd("tok"))).rejects.toThrow(
      "REDIRECT:/student/set-password"
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "tok" });
  });

  it("rejects when no token_hash is present (passive prefetch is inert)", async () => {
    await expect(confirmStudentInvite(fd(null))).rejects.toThrow("error=link");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("still proceeds when a re-submitted single-use OTP fails but the session is already valid (otp_expired regression)", async () => {
    // The first verify created the session; this second verify fails — but the
    // member already holds a valid student session, so they must NOT be locked out.
    verifyError = { message: "Token has expired or is invalid" };
    sessionUser = { app_metadata: { role: "student" } };
    await expect(confirmStudentInvite(fd("used"))).rejects.toThrow(
      "REDIRECT:/student/set-password"
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it("rejects when the OTP fails and there is no session to fall back on", async () => {
    verifyError = { message: "Token has expired or is invalid" };
    sessionUser = null;
    await expect(confirmStudentInvite(fd("used"))).rejects.toThrow("error=link");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and rejects a non-student (e.g. admin) token", async () => {
    sessionUser = { app_metadata: { role: "admin" } };
    await expect(confirmStudentInvite(fd("adm"))).rejects.toThrow("error=link");
    expect(signOut).toHaveBeenCalled();
  });
});
