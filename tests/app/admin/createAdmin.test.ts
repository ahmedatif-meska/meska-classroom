import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown>; email?: string };
let currentUser: User | null = null;
let isAdminEmailReturn = false;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const rpc = vi.fn(async (fn: string) => {
  if (fn === "is_admin_email") return { data: isAdminEmailReturn, error: null };
  return { data: null, error: null };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, rpc })),
}));

const inviteUserByEmail = vi.fn();
const updateUserById = vi.fn(async () => ({ data: {}, error: null }));
const insert = vi.fn(async () => ({ error: null }));
const adminFrom = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail, updateUserById } },
    from: adminFrom,
  })),
}));

import { createAdmin } from "@/app/admin/actions";

function form(first: string | null, last: string | null, email: string | null) {
  const fd = new FormData();
  if (first !== null) fd.set("first_name", first);
  if (last !== null) fd.set("last_name", last);
  if (email !== null) fd.set("email", email);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = {
    id: "caller-id",
    app_metadata: { role: "admin" },
    email: "admin@example.com",
  };
  isAdminEmailReturn = false;
  inviteUserByEmail.mockResolvedValue({
    data: { user: { id: "new-id" } },
    error: null,
  });
  insert.mockResolvedValue({ error: null });
});

describe("createAdmin (US2.1)", () => {
  it("denies a non-admin caller before any Admin-API call (FR-017)", async () => {
    currentUser = null;
    const result = await createAdmin({}, form("John", "Doe", "j@x.com"));
    expect(result).toEqual({ error: strings.adminMgmtForbidden });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects a duplicate admin email without inviting (FR-008)", async () => {
    isAdminEmailReturn = true;
    const result = await createAdmin({}, form("John", "Doe", "dupe@x.com"));
    expect(result).toEqual({ error: strings.adminMgmtEmailInUse });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("blocks invalid fields before any backend call (FR-007)", async () => {
    const result = await createAdmin({}, form("", "Doe", "j@x.com"));
    expect(result).toEqual({ error: strings.adminMgmtNameRequired });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites, sets the role claim, inserts a pending profile, and audits on success (FR-009)", async () => {
    const result = await createAdmin({}, form("John", "Doe", "John@X.com"));
    expect(result).toEqual({ created: true, inviteFailed: false });

    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "john@x.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("/admin/auth/confirm"),
        data: { first_name: "John", last_name: "Doe" },
      })
    );
    expect(updateUserById).toHaveBeenCalledWith("new-id", {
      app_metadata: { role: "admin" },
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "new-id",
        email: "john@x.com",
        first_name: "John",
        last_name: "Doe",
        role: "admin",
        status: "pending",
      })
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "john@x.com",
      p_outcome: "success",
      p_reason: "admin_created",
    });
  });

  it("still creates the pending admin but reports inviteFailed when the send errors (FR-021)", async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-id" } },
      error: { message: "smtp down" },
    });
    const result = await createAdmin({}, form("John", "Doe", "j@x.com"));
    expect(result).toEqual({ created: true, inviteFailed: true });
    expect(insert).toHaveBeenCalled();
  });

  it("maps an already-registered email to the in-use error", async () => {
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    const result = await createAdmin({}, form("John", "Doe", "j@x.com"));
    expect(result).toEqual({ error: strings.adminMgmtEmailInUse });
    expect(insert).not.toHaveBeenCalled();
  });
});
