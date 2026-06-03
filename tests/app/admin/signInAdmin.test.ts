import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

// redirect() throws to interrupt control flow — mock it so we can assert the target.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// The Supabase server client is mocked per-test via this handle.
const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
    rpc,
  })),
}));

import { signInAdmin } from "@/app/admin/actions";

function form(email: string | null, password: string | null) {
  const fd = new FormData();
  if (email !== null) fd.set("email", email);
  if (password !== null) fd.set("password", password);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("signInAdmin (US1.2 / US2.1 / US3.1)", () => {
  it("redirects an admin to /admin/dashboard on success", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: "admin" } } } },
      error: null,
    });
    await expect(signInAdmin({}, form("ADMIN@example.com", "pw"))).rejects.toThrow(
      "REDIRECT:/admin/dashboard"
    );
    // email is normalized to lower-case before auth
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "pw",
    });
  });

  it("denies a valid non-admin and signs it out, no session retained", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: "student" } } } },
      error: null,
    });
    const result = await signInAdmin({}, form("student@example.com", "pw"));
    expect(result).toEqual({ error: strings.adminAuthFailed });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("denies a wrong password with the generic message", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    const result = await signInAdmin({}, form("admin@example.com", "wrong"));
    expect(result).toEqual({ error: strings.adminAuthFailed });
  });

  it("denies an unknown email with the IDENTICAL generic message (no enumeration)", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    const unknown = await signInAdmin({}, form("nobody@example.com", "pw"));
    expect(unknown.error).toBe(strings.adminAuthFailed);
  });

  it("blocks empty fields BEFORE any auth call (mandatory fields)", async () => {
    const result = await signInAdmin({}, form("", ""));
    expect(result).toEqual({ error: strings.adminEmailRequired });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
