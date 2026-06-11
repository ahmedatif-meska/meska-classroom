import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
type TargetRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  tenant_id: string | null;
};

let currentUser: User | null = null;
let waveRow: { id: string } | null = null;
let targetRows: TargetRow[] = [];
let targetsError: { message: string } | null = null;

// Per-member behaviors for the two students UPDATE shapes the action issues.
let casResults: Record<
  string,
  { data: { id: string }[] | null; error: { message: string } | null }
> = {};
let claimsErrors: Record<string, { message: string } | null> = {};

// Every students UPDATE is recorded: cas=true is the assign
// (`.eq().is("tenant_id", null).select()`), cas=false the revert (`.eq()` awaited).
type UpdateCall = { values: Record<string, unknown>; id?: string; cas: boolean };
let updateCalls: UpdateCall[] = [];

const invalidateSpy = vi.fn(async () => {});
vi.mock("@/lib/cache/redis", () => ({
  invalidate: (...keys: string[]) => invalidateSpy(...keys),
}));

const logErrorSpy = vi.fn(async () => {});
vi.mock("@/lib/errors/log", () => ({
  logError: (input: unknown) => logErrorSpy(input),
}));

const rpc = vi.fn(async () => ({ data: null, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

const from = vi.fn((table: string) => {
  if (table === "tenants") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: waveRow, error: null }),
        }),
      }),
    };
  }
  // students
  return {
    select: () => ({
      in: async () => ({
        data: targetsError ? null : targetRows,
        error: targetsError,
      }),
    }),
    update: (values: Record<string, unknown>) => {
      const call: UpdateCall = { values, cas: false };
      updateCalls.push(call);
      return {
        eq: (_col: string, id: string) => {
          call.id = id;
          return {
            // Revert path awaits `.eq()` directly — a plain object resolves to
            // itself under await, exposing `error`.
            error: null,
            is: () => {
              call.cas = true;
              return {
                select: async () =>
                  casResults[id] ?? { data: [{ id }], error: null },
              };
            },
          };
        },
      };
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

const updateUserById = vi.fn(async (id: string) => ({
  data: {},
  error: claimsErrors[id] ?? null,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { updateUserById } },
  })),
}));

import { reassignMembers } from "@/app/admin/members/actions";

function form(waveId: string | null, ids: string[]) {
  const fd = new FormData();
  if (waveId !== null) fd.set("wave_id", waveId);
  for (const id of ids) fd.append("member_ids", id);
  return fd;
}

function assignCalls() {
  return updateCalls.filter((c) => c.cas);
}
function revertCalls() {
  return updateCalls.filter((c) => !c.cas);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
  waveRow = { id: "wave-A" };
  targetRows = [
    { id: "m1", user_id: "u-1", email: "a@x.com", tenant_id: null },
    { id: "m2", user_id: "u-2", email: "b@x.com", tenant_id: null },
  ];
  targetsError = null;
  casResults = {};
  claimsErrors = {};
  updateCalls = [];
});

describe("reassignMembers", () => {
  it("denies a non-admin caller before touching any data", async () => {
    currentUser = { id: "x", app_metadata: { role: "student" } };
    const result = await reassignMembers({}, form("wave-A", ["m1"]));
    expect(result).toEqual({ error: strings.memberMgmtForbidden });
    expect(from).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("requires a wave selection", async () => {
    const result = await reassignMembers({}, form(null, ["m1"]));
    expect(result).toEqual({ error: strings.memberMgmtWaveRequired });
  });

  it("requires at least one selected member", async () => {
    const result = await reassignMembers({}, form("wave-A", []));
    expect(result).toEqual({ error: strings.reassignNoSelection });
  });

  it("fails before any write when the target wave does not exist", async () => {
    waveRow = null;
    const result = await reassignMembers({}, form("missing", ["m1"]));
    expect(result).toEqual({ error: strings.reassignFailed });
    expect(updateCalls).toHaveLength(0);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("reassigns multiple unassigned members: row CAS, JWT claims, audit, caches", async () => {
    const result = await reassignMembers({}, form("wave-A", ["m1", "m2"]));
    expect(result).toEqual({ reassignedCount: 2, failedCount: 0 });

    // Row updates are compare-and-set on tenant_id null.
    expect(assignCalls().map((c) => c.id)).toEqual(["m1", "m2"]);
    for (const c of assignCalls()) {
      expect(c.values).toEqual({ tenant_id: "wave-A" });
    }

    // The wave is mirrored into the auth claims RLS reads (provisionMember shape).
    expect(updateUserById).toHaveBeenCalledWith("u-1", {
      app_metadata: { role: "student", tenant_id: "wave-A" },
    });
    expect(updateUserById).toHaveBeenCalledWith("u-2", {
      app_metadata: { role: "student", tenant_id: "wave-A" },
    });

    // Audited per member.
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "a@x.com",
      p_outcome: "success",
      p_reason: "member_reassigned",
    });
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "b@x.com",
      p_outcome: "success",
      p_reason: "member_reassigned",
    });

    // Member-list cache dropped; per-user profile keys under the new wave dropped.
    expect(invalidateSpy).toHaveBeenCalledWith("admin:members:list");
    expect(invalidateSpy).toHaveBeenCalledWith("student:wave-A:u-1:profile");
    expect(invalidateSpy).toHaveBeenCalledWith("student:wave-A:u-2:profile");
  });

  it("never overwrites an already-assigned member — counted as failed", async () => {
    targetRows = [
      { id: "m1", user_id: "u-1", email: "a@x.com", tenant_id: null },
      { id: "m2", user_id: "u-2", email: "b@x.com", tenant_id: "wave-B" },
    ];
    const result = await reassignMembers({}, form("wave-A", ["m1", "m2"]));
    expect(result).toEqual({ reassignedCount: 1, failedCount: 1 });
    expect(assignCalls().map((c) => c.id)).toEqual(["m1"]);
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledWith("u-1", expect.anything());
  });

  it("counts ids that resolve to no member row as failed", async () => {
    targetRows = [{ id: "m1", user_id: "u-1", email: "a@x.com", tenant_id: null }];
    const result = await reassignMembers({}, form("wave-A", ["m1", "ghost"]));
    expect(result).toEqual({ reassignedCount: 1, failedCount: 1 });
  });

  it("reverts the row and reports a failure when the claims update fails", async () => {
    claimsErrors["u-2"] = { message: "gotrue down" };
    const result = await reassignMembers({}, form("wave-A", ["m1", "m2"]));
    expect(result).toEqual({ reassignedCount: 1, failedCount: 1 });

    // m2's row was claimed, then rolled back to unassigned (retryable).
    expect(assignCalls().map((c) => c.id)).toEqual(["m1", "m2"]);
    expect(revertCalls()).toHaveLength(1);
    expect(revertCalls()[0]).toMatchObject({
      id: "m2",
      values: { tenant_id: null },
    });

    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "reassignMembers",
        context: expect.objectContaining({ memberId: "m2", step: "updateClaims" }),
      })
    );

    // No audit and no profile invalidation for the failed member.
    expect(rpc).not.toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "b@x.com",
      p_outcome: "success",
      p_reason: "member_reassigned",
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith("student:wave-A:u-2:profile");
  });

  it("loses a concurrent-assignment race gracefully (no claims write, no revert)", async () => {
    casResults["m1"] = { data: [], error: null };
    const result = await reassignMembers({}, form("wave-A", ["m1", "m2"]));
    expect(result).toEqual({ reassignedCount: 1, failedCount: 1 });
    expect(updateUserById).not.toHaveBeenCalledWith("u-1", expect.anything());
    expect(updateUserById).toHaveBeenCalledWith("u-2", expect.anything());
    expect(revertCalls()).toHaveLength(0);
  });

  it("reassigns a legacy roster row without an auth user (no Admin-API call)", async () => {
    targetRows = [
      { id: "m1", user_id: null, email: "legacy@x.com", tenant_id: null },
    ];
    const result = await reassignMembers({}, form("wave-A", ["m1"]));
    expect(result).toEqual({ reassignedCount: 1, failedCount: 0 });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith("admin:members:list");
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("profile")
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "legacy@x.com",
      p_outcome: "success",
      p_reason: "member_reassigned",
    });
  });
});
