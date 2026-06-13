import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

type User = { id: string; app_metadata?: Record<string, unknown> } | null;
let currentUser: User = null;
let updateError: { message: string } | null = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const updateUser = vi.fn(async () => ({ data: {}, error: updateError }));
// Feature 012 (FR-005): a successful password change revokes OTHER sessions.
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser, updateUser, signOut },
  })),
}));

// The status flip runs on the service-role client (RLS blocks a student updating
// their own students row).
const eq = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq }));
const adminFrom = vi.fn(() => ({ update }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom })),
}));

import { setStudentPassword } from "@/app/student/actions";

function form(password: string, confirm: string) {
  const fd = new FormData();
  fd.set("password", password);
  fd.set("confirm", confirm);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "member-id", app_metadata: { role: "student" } };
  updateError = null;
});

describe("setStudentPassword (US3.1)", () => {
  it("sets the password, flips status to active, and redirects to the dashboard", async () => {
    await expect(
      setStudentPassword({}, form("longenough", "longenough"))
    ).rejects.toThrow("REDIRECT:/student/dashboard");
    expect(updateUser).toHaveBeenCalledWith({ password: "longenough" });
    // Other sessions are revoked with the password change (FR-005, feature 012).
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(update).toHaveBeenCalledWith({ status: "active" });
    expect(eq).toHaveBeenCalledWith("user_id", "member-id");
  });

  it("refuses when there is no valid student session (invalid/expired link)", async () => {
    currentUser = null;
    const result = await setStudentPassword({}, form("longenough", "longenough"));
    expect(result).toEqual({ error: strings.studentResetLinkInvalid });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses an admin session reaching the student set-password flow", async () => {
    currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
    const result = await setStudentPassword({}, form("longenough", "longenough"));
    expect(result).toEqual({ error: strings.studentResetLinkInvalid });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects a too-short / mismatched password before updating", async () => {
    const result = await setStudentPassword({}, form("short", "short"));
    expect(result).toEqual({ error: strings.resetPasswordTooShort });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
