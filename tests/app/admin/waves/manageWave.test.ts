import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidate: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };
let studentsCount = 0;
let weeksCount = 0;
let updateError: unknown = null;
let deleteError: unknown = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const deleteEq = vi.fn(async () => ({ error: deleteError }));
const updateEq = vi.fn(async () => ({ error: updateError }));

const from = vi.fn((table: string) => ({
  select: () => ({
    eq: async () => ({
      count: table === "students" ? studentsCount : weeksCount,
      error: null,
    }),
  }),
  update: () => ({ eq: updateEq }),
  delete: () => ({ eq: deleteEq }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import { updateWave, deleteWave } from "@/app/admin/waves/actions";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  studentsCount = 0;
  weeksCount = 0;
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

describe("deleteWave (US4.1 — block-while-non-empty, FR-018)", () => {
  it("blocks deletion when the wave has members", async () => {
    studentsCount = 2;
    const result = await deleteWave({}, fd({ id: "w1" }));
    expect(result).toEqual({ error: strings.wavesDeleteBlocked });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("blocks deletion when the wave has weeks", async () => {
    weeksCount = 1;
    const result = await deleteWave({}, fd({ id: "w1" }));
    expect(result).toEqual({ error: strings.wavesDeleteBlocked });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("deletes an empty wave", async () => {
    const result = await deleteWave({}, fd({ id: "w1" }));
    expect(result).toEqual({ removed: true });
    expect(deleteEq).toHaveBeenCalledTimes(1);
  });
});
