import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidate: vi.fn(async () => {}) }));
vi.mock("@/lib/errors/log", () => ({ logError: vi.fn(async () => {}) }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };
let updateError: unknown = null;

const eq = vi.fn(async () => ({ error: updateError }));
const update = vi.fn(() => ({ eq }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const from = vi.fn(() => ({ update }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import { reorderInstructors } from "@/app/admin/instructors/actions";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  updateError = null;
});

describe("reorderInstructors", () => {
  it("denies a non-admin and writes nothing", async () => {
    currentUser = null;
    const r = await reorderInstructors(["a", "b"]);
    expect(r).toEqual({ error: strings.instructorsForbidden });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an empty or malformed list", async () => {
    expect(await reorderInstructors([])).toEqual({
      error: strings.instructorsReorderFailed,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("writes each id's 1-based position in order", async () => {
    const r = await reorderInstructors(["c", "a", "b"]);
    expect(r).toEqual({ saved: true });
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenNthCalledWith(1, { position: 1 });
    expect(update).toHaveBeenNthCalledWith(2, { position: 2 });
    expect(update).toHaveBeenNthCalledWith(3, { position: 3 });
    expect(eq).toHaveBeenNthCalledWith(1, "id", "c");
    expect(eq).toHaveBeenNthCalledWith(2, "id", "a");
    expect(eq).toHaveBeenNthCalledWith(3, "id", "b");
  });

  it("returns an error when a position write fails", async () => {
    updateError = { message: "db" };
    const r = await reorderInstructors(["a", "b"]);
    expect(r).toEqual({ error: strings.instructorsReorderFailed });
  });
});
