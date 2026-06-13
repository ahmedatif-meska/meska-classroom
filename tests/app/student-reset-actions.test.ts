import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

/**
 * US1 — student forgot-password request (FR-002/FR-003) and the FR-005
 * other-session revocation on the reused set-password flow.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

let isStudentValue = false;
type User = { id: string; app_metadata?: Record<string, unknown> } | null;
let currentUser: User = null;

const resetPasswordForEmail = vi.fn<
  (
    email: string,
    opts?: { redirectTo?: string }
  ) => Promise<{ data: object; error: null }>
>(async () => ({ data: {}, error: null }));
const rpc = vi.fn(async (fn: string) => {
  if (fn === "is_student_email") return { data: isStudentValue, error: null };
  return { data: null, error: null };
});
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const updateUser = vi.fn(async () => ({ data: {}, error: null }));
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { resetPasswordForEmail, rpc, getUser, updateUser, signOut },
    rpc,
  })),
}));

// setStudentPassword flips the students row on the service-role client.
const eq = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq }));
const adminFrom = vi.fn(() => ({ update }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom })),
}));

import {
  requestStudentPasswordReset,
  setStudentPassword,
} from "@/app/student/actions";

function emailForm(email: string | null) {
  const fd = new FormData();
  if (email !== null) fd.set("email", email);
  return fd;
}

function pwForm(password: string, confirm: string) {
  const fd = new FormData();
  fd.set("password", password);
  fd.set("confirm", confirm);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  isStudentValue = false;
  currentUser = { id: "member-id", app_metadata: { role: "student" } };
});

describe("requestStudentPasswordReset (US1)", () => {
  it("blocks an empty email BEFORE any backend call", async () => {
    const result = await requestStudentPasswordReset({}, emailForm(""));
    expect(result).toEqual({ error: strings.forgotEmailRequired });
    expect(rpc).not.toHaveBeenCalled();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a reset link to a member email, redirecting to the student confirm route (FR-003/FR-004)", async () => {
    isStudentValue = true;
    const result = await requestStudentPasswordReset(
      {},
      emailForm("MEMBER@Example.com")
    );
    // email normalized to lower-case before the gate + send
    expect(rpc).toHaveBeenCalledWith("is_student_email", {
      p_email: "member@example.com",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledOnce();
    expect(resetPasswordForEmail.mock.calls[0][0]).toBe("member@example.com");
    expect(
      resetPasswordForEmail.mock.calls[0][1]?.redirectTo?.endsWith(
        "/student/auth/confirm"
      )
    ).toBe(true);
    expect(result).toEqual({ sent: true });
  });

  it("does NOT send a link for a non-member email but STILL confirms (non-enumeration, FR-002/SC-002)", async () => {
    isStudentValue = false;
    const result = await requestStudentPasswordReset(
      {},
      emailForm("nobody@example.com")
    );
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: true });
  });

  it("returns the IDENTICAL neutral state for member and non-member", async () => {
    isStudentValue = true;
    const memberState = await requestStudentPasswordReset(
      {},
      emailForm("member@example.com")
    );
    isStudentValue = false;
    const otherState = await requestStudentPasswordReset(
      {},
      emailForm("admin-only@example.com")
    );
    expect(memberState).toEqual(otherState);
  });
});

describe("setStudentPassword — FR-005 session revocation", () => {
  it("revokes the member's OTHER sessions after a successful password update", async () => {
    await expect(
      setStudentPassword({}, pwForm("longenough", "longenough"))
    ).rejects.toThrow("REDIRECT:/student/dashboard");
    expect(updateUser).toHaveBeenCalledWith({ password: "longenough" });
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("does not touch other sessions when validation fails", async () => {
    const result = await setStudentPassword({}, pwForm("short", "short"));
    expect(result).toEqual({ error: strings.resetPasswordTooShort });
    expect(signOut).not.toHaveBeenCalled();
  });
});
