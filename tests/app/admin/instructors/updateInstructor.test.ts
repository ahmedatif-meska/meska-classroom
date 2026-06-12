import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let existing: { image_path: string | null } = { image_path: "old.png" };

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

const eqUpdate = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq: eqUpdate }));
const maybeSingle = vi.fn(async () => ({ data: existing }));
const eqSelect = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq: eqSelect }));
const from = vi.fn(() => ({ update, select }));

const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
const remove = vi.fn(async () => ({ data: null, error: null }));
const storageFrom = vi.fn(() => ({ upload, remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { updateInstructor } from "@/app/admin/instructors/actions";

function form(opts: {
  id?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string;
  image?: File;
}) {
  const fd = new FormData();
  if (opts.id !== null && opts.id !== undefined) fd.set("id", opts.id);
  if (opts.name !== null && opts.name !== undefined) fd.set("name", opts.name);
  const title = opts.title === undefined ? "Lead Instructor" : opts.title;
  if (title !== null) fd.set("title", title);
  if (opts.description !== undefined) fd.set("description_html", opts.description);
  if (opts.image) fd.set("image", opts.image);
  return fd;
}

const pngFile = () =>
  new File([new Uint8Array(20)], "a.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller", app_metadata: { role: "admin" } };
  existing = { image_path: "old.png" };
  eqUpdate.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ data: { path: "x" }, error: null });
});

describe("updateInstructor (US3.1)", () => {
  it("denies a non-admin caller before any write (FR-015)", async () => {
    currentUser = null;
    const result = await updateInstructor({}, form({ id: "i1", name: "Sarah" }));
    expect(result).toEqual({ error: strings.instructorsForbidden });
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks an empty name with no update", async () => {
    const result = await updateInstructor({}, form({ id: "i1", name: "" }));
    expect(result).toEqual({ error: strings.instructorsNameRequired });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates name + sanitized description and keeps the existing image when none is sent", async () => {
    const result = await updateInstructor(
      {},
      form({ id: "i1", name: "New Name", description: "<b>x</b><script>y</script>" })
    );
    expect(result).toEqual({ saved: true });
    expect(upload).not.toHaveBeenCalled();

    const arg = update.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe("New Name");
    expect(arg).toHaveProperty("updated_at");
    expect("image_path" in arg).toBe(false);
    expect(String(arg.description_html).toLowerCase()).not.toContain("script");
    expect(eqUpdate).toHaveBeenCalledWith("id", "i1");
  });

  it("replaces the image and best-effort removes the old object", async () => {
    const result = await updateInstructor(
      {},
      form({ id: "i1", name: "Sarah", image: pngFile() })
    );
    expect(result).toEqual({ saved: true });
    expect(upload).toHaveBeenCalledTimes(1);
    const arg = update.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.image_path).toEqual(expect.any(String));
    expect(remove).toHaveBeenCalledWith(["old.png"]);
  });
});
