import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidate: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };
let members: { user_id: string | null }[] = [];
let materials: { file_path: string }[] = [];
let subs: { file_path: string }[] = [];
let updateError: unknown = null;
let deleteError: unknown = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const deleteEq = vi.fn(async () => ({ error: deleteError }));
const updateEq = vi.fn(async () => ({ error: updateError }));
const storageRemove = vi.fn(async () => ({ error: null }));

const from = vi.fn((table: string) => ({
  select: () => ({
    eq: async () => ({
      data:
        table === "students"
          ? members
          : table === "wave_materials"
            ? materials
            : table === "wave_submissions"
              ? subs
              : [],
      error: null,
    }),
  }),
  update: () => ({ eq: updateEq }),
  delete: () => ({ eq: deleteEq }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: () => ({ remove: storageRemove }) },
  })),
}));

import { updateWave, deleteWave } from "@/app/admin/waves/actions";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  members = [];
  materials = [];
  subs = [];
  updateError = null;
  deleteError = null;
});

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("updateWave (US4.1)", () => {
  it("updates name/type/description on success", async () => {
    const result = await updateWave(
      {},
      fd({ id: "w1", name: " New ", type: "online", description_html: "<p>x</p>" })
    );
    expect(result).toEqual({ saved: true });
    expect(updateEq).toHaveBeenCalledTimes(1);
  });

  it("denies a non-admin", async () => {
    currentUser = null;
    expect(await updateWave({}, fd({ id: "w1", name: "X", type: "online" }))).toEqual(
      { error: strings.wavesForbidden }
    );
    expect(updateEq).not.toHaveBeenCalled();
  });
});

describe("deleteWave (US4.1 — unassigns members, keeps accounts)", () => {
  it("deletes a wave that has members and content (members are kept, just unassigned)", async () => {
    members = [{ user_id: "u1" }, { user_id: "u2" }];
    materials = [{ file_path: "w1/wk1/a.pdf" }];
    subs = [{ file_path: "w1/as1/u1/submission.pdf" }];
    const result = await deleteWave({}, fd({ id: "w1" }));
    expect(result).toEqual({ removed: true });
    expect(deleteEq).toHaveBeenCalledTimes(1);
    // Storage objects for materials and submissions are cleaned up best-effort.
    expect(storageRemove).toHaveBeenCalled();
  });

  it("deletes an empty wave", async () => {
    const result = await deleteWave({}, fd({ id: "w1" }));
    expect(result).toEqual({ removed: true });
    expect(deleteEq).toHaveBeenCalledTimes(1);
  });

  it("denies a non-admin", async () => {
    currentUser = null;
    expect(await deleteWave({}, fd({ id: "w1" }))).toEqual({
      error: strings.wavesForbidden,
    });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("returns an error when the delete fails", async () => {
    deleteError = { message: "nope" };
    expect(await deleteWave({}, fd({ id: "w1" }))).toEqual({
      error: strings.wavesRemoveFailed,
    });
  });
});
