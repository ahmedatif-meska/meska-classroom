import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let target: { user_id: string | null; email: string | null } | null = null;

const maybeSingle = vi.fn(async () => ({ data: target, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

// Service-role Admin API: deleteUser (cascades the students row) + direct delete.
const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
const adminDeleteEq = vi.fn(async () => ({ error: null }));
const adminDelete = vi.fn(() => ({ eq: adminDeleteEq }));
const adminFrom = vi.fn(() => ({ delete: adminDelete }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
    from: adminFrom,
  })),
}));

import { removeMember } from "@/app/admin/members/actions";

function form(targetId: string | null) {
  const fd = new FormData();
  if (targetId !== null) fd.set("target_id", targetId);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
  target = { user_id: "u-1", email: "gone@x.com" };
  deleteUser.mockResolvedValue({ data: {}, error: null });
});

describe("removeMember", () => {
  it("denies a non-admin caller before any Admin-API call", async () => {
    currentUser = null;
    const result = await removeMember({}, form("m1"));
    expect(result).toEqual({ error: strings.memberMgmtForbidden });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("fails when no target id is provided", async () => {
    const result = await removeMember({}, form(null));
    expect(result).toEqual({ error: strings.removeMemberFailed });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("fails when the member does not exist", async () => {
    target = null;
    const result = await removeMember({}, form("missing"));
    expect(result).toEqual({ error: strings.removeMemberFailed });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the auth user (cascading the row) and audits member_removed", async () => {
    const result = await removeMember({}, form("m1"));
    expect(result).toEqual({ removed: true });
    expect(deleteUser).toHaveBeenCalledWith("u-1");
    expect(adminDelete).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "gone@x.com",
      p_outcome: "success",
      p_reason: "member_removed",
    });
  });

  it("deletes the students row directly when it has no auth user", async () => {
    target = { user_id: null, email: "noauth@x.com" };
    const result = await removeMember({}, form("m1"));
    expect(result).toEqual({ removed: true });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(adminDelete).toHaveBeenCalled();
    expect(adminDeleteEq).toHaveBeenCalledWith("id", "m1");
  });

  it("surfaces a failure when the Admin-API delete errors", async () => {
    deleteUser.mockResolvedValue({ data: {}, error: { message: "boom" } });
    const result = await removeMember({}, form("m1"));
    expect(result).toEqual({ error: strings.removeMemberFailed });
  });
});
