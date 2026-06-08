import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/redis", () => ({ invalidate: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;

const insert = vi.fn(async () => ({ error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const from = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import { createWave } from "@/app/admin/waves/actions";

function form(opts: { name?: string | null; type?: string | null; description?: string }) {
  const fd = new FormData();
  if (opts.name != null) fd.set("name", opts.name);
  if (opts.type != null) fd.set("type", opts.type);
  if (opts.description !== undefined) fd.set("description_html", opts.description);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller", app_metadata: { role: "admin" } };
  insert.mockResolvedValue({ error: null });
});

describe("createWave (US1.1)", () => {
  it("denies a non-admin before any write (FR-015)", async () => {
    currentUser = null;
    const result = await createWave({}, form({ name: "July", type: "online" }));
    expect(result).toEqual({ error: strings.wavesForbidden });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a missing name", async () => {
    const result = await createWave({}, form({ name: "  ", type: "online" }));
    expect(result).toEqual({ error: strings.wavesNameRequired });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid type", async () => {
    expect(await createWave({}, form({ name: "July", type: "" }))).toEqual({
      error: strings.wavesTypeRequired,
    });
    expect(await createWave({}, form({ name: "July", type: "hybrid" }))).toEqual({
      error: strings.wavesTypeRequired,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a trimmed name, type, and sanitized description on success", async () => {
    const result = await createWave(
      {},
      form({
        name: "  July Cohort ",
        type: "offline",
        description: "<p>Hi</p><script>alert(1)</script>",
      })
    );
    expect(result).toEqual({ saved: true });
    const row = insert.mock.calls[0][0] as {
      name: string;
      type: string;
      description_html: string | null;
    };
    expect(row.name).toBe("July Cohort");
    expect(row.type).toBe("offline");
    expect(row.description_html).toContain("<p>Hi</p>");
    expect(row.description_html?.toLowerCase()).not.toContain("script");
  });

  it("stores a null description when omitted", async () => {
    await createWave({}, form({ name: "X", type: "online" }));
    expect((insert.mock.calls[0][0] as { description_html: string | null }).description_html).toBeNull();
  });

  it("returns a save error when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    const result = await createWave({}, form({ name: "X", type: "online" }));
    expect(result).toEqual({ error: strings.wavesSaveFailed });
  });
});
