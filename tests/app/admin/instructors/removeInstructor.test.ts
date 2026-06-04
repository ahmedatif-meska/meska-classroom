import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

const eqDelete = vi.fn(async () => ({ error: null }));
const del = vi.fn(() => ({ eq: eqDelete }));
const maybeSingle = vi.fn(async () => ({ data: { image_path: "p.png" } }));
const eqSelect = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq: eqSelect }));
const from = vi.fn(() => ({ delete: del, select }));

const remove = vi.fn(async () => ({ data: null, error: null }));
const storageFrom = vi.fn(() => ({ remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { removeInstructor } from "@/app/admin/instructors/actions";

function form(id: string | null) {
  const fd = new FormData();
  if (id !== null) fd.set("id", id);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller", app_metadata: { role: "admin" } };
  eqDelete.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ data: null, error: null });
});

describe("removeInstructor (US4.1)", () => {
  it("denies a non-admin caller before any delete (FR-015)", async () => {
    currentUser = null;
    const result = await removeInstructor({}, form("i1"));
    expect(result).toEqual({ error: strings.instructorsForbidden });
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes the row and best-effort removes the storage object on success", async () => {
    const result = await removeInstructor({}, form("i1"));
    expect(result).toEqual({ removed: true });
    expect(eqDelete).toHaveBeenCalledWith("id", "i1");
    expect(remove).toHaveBeenCalledWith(["p.png"]);
  });

  it("still removes the instructor when the storage delete fails (R11)", async () => {
    remove.mockRejectedValue(new Error("storage down"));
    const result = await removeInstructor({}, form("i1"));
    expect(result).toEqual({ removed: true });
    expect(eqDelete).toHaveBeenCalledWith("id", "i1");
  });

  it("returns a remove error when the row delete fails", async () => {
    eqDelete.mockResolvedValue({ error: { message: "db down" } });
    const result = await removeInstructor({}, form("i1"));
    expect(result).toEqual({ error: strings.instructorsRemoveFailed });
  });
});
