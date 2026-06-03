import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let activeIds: { id: string }[] = [];

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const eq = vi.fn(async () => ({ data: activeIds, error: null }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

const deleteUser = vi.fn(async () => ({ data: {}, error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ auth: { admin: { deleteUser } } })),
}));

import { removeAdmin } from "@/app/admin/actions";

function form(targetId: string | null, email = "target@x.com") {
  const fd = new FormData();
  if (targetId !== null) fd.set("target_id", targetId);
  fd.set("target_email", email);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller-id", app_metadata: { role: "admin" } };
  activeIds = [{ id: "caller-id" }, { id: "target-id" }];
  deleteUser.mockResolvedValue({ data: {}, error: null });
});

describe("removeAdmin (US4.1)", () => {
  it("denies a non-admin caller before any Admin-API call (FR-017)", async () => {
    currentUser = null;
    const result = await removeAdmin({}, form("target-id"));
    expect(result).toEqual({ error: strings.adminMgmtForbidden });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("blocks removing your own account (FR-015)", async () => {
    const result = await removeAdmin({}, form("caller-id"));
    expect(result).toEqual({ error: strings.adminMgmtNoSelfRemove });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("blocks removing the last active admin (FR-016)", async () => {
    activeIds = [{ id: "target-id" }]; // target is the only active admin
    const result = await removeAdmin({}, form("target-id"));
    expect(result).toEqual({ error: strings.adminMgmtLastAdmin });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("allows removing a pending admin while an active admin remains", async () => {
    activeIds = [{ id: "caller-id" }]; // target 'pending-id' is not active
    const result = await removeAdmin({}, form("pending-id"));
    expect(result).toEqual({ removed: true });
    expect(deleteUser).toHaveBeenCalledWith("pending-id");
  });

  it("deletes the user and audits on success (FR-014)", async () => {
    const result = await removeAdmin({}, form("target-id", "gone@x.com"));
    expect(result).toEqual({ removed: true });
    expect(deleteUser).toHaveBeenCalledWith("target-id");
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "gone@x.com",
      p_outcome: "success",
      p_reason: "admin_removed",
    });
  });
});
