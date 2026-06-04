import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
  })),
}));

import { signInStudent } from "@/app/student/actions";

function form(email: string | null, password: string | null) {
  const fd = new FormData();
  if (email !== null) fd.set("email", email);
  if (password !== null) fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
});

describe("signInStudent (US3.1)", () => {
  it("redirects a member to /student/dashboard on success", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: "student" } } } },
      error: null,
    });
    await expect(
      signInStudent({}, form("Mona@X.com", "pw"))
    ).rejects.toThrow("REDIRECT:/student/dashboard");
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "mona@x.com",
      password: "pw",
    });
  });

  it("denies an admin token (not a student session) and signs it out", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: "admin" } } } },
      error: null,
    });
    const result = await signInStudent({}, form("admin@x.com", "pw"));
    expect(result).toEqual({ error: strings.studentAuthFailed });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("denies bad credentials (a pending member without a password) generically", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    const result = await signInStudent({}, form("m@x.com", "wrong"));
    expect(result).toEqual({ error: strings.studentAuthFailed });
  });

  it("blocks empty fields before any auth call", async () => {
    const result = await signInStudent({}, form("", ""));
    expect(result).toEqual({ error: strings.studentEmailRequired });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
