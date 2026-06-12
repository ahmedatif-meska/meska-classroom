import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const insert = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
const remove = vi.fn(async () => ({ data: null, error: null }));
let lastPositionRow: { position: number } | null = null;
const maybeSingle = vi.fn(async () => ({ data: lastPositionRow, error: null }));
// from("instructors") supports both the position lookup (select→order→limit→
// maybeSingle) and the insert.
const from = vi.fn(() => ({
  insert,
  select: () => ({ order: () => ({ limit: () => ({ maybeSingle }) }) }),
}));
const storageFrom = vi.fn(() => ({ upload, remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { createInstructor } from "@/app/admin/instructors/actions";

function form(opts: {
  name?: string | null;
  title?: string | null;
  description?: string;
  image?: File;
}) {
  const fd = new FormData();
  if (opts.name !== null && opts.name !== undefined) fd.set("name", opts.name);
  // Default a valid title so name/image-focused cases pass validation; pass
  // title: null to omit it explicitly.
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
  lastPositionRow = null;
  insert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ data: { path: "x" }, error: null });
});

describe("createInstructor (US2.1)", () => {
  it("denies a non-admin caller before any write (FR-015)", async () => {
    currentUser = null;
    const result = await createInstructor({}, form({ name: "Sarah" }));
    expect(result).toEqual({ error: strings.instructorsForbidden });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks an empty name with no write", async () => {
    const result = await createInstructor({}, form({ name: "  " }));
    expect(result).toEqual({ error: strings.instructorsNameRequired });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks a missing title with no write", async () => {
    const result = await createInstructor(
      {},
      form({ name: "Sarah", title: null })
    );
    expect(result).toEqual({ error: strings.instructorsTitleRequired });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an unsupported image type with no write", async () => {
    const gif = new File([new Uint8Array(10)], "a.gif", { type: "image/gif" });
    const result = await createInstructor({}, form({ name: "Sarah", image: gif }));
    expect(result).toEqual({ error: strings.instructorsImageInvalid });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("uploads the image, stores a sanitized description, and inserts on success", async () => {
    const result = await createInstructor(
      {},
      form({
        name: "  Sarah Lee ",
        description: "<p>Hello</p><script>alert(1)</script>",
        image: pngFile(),
      })
    );
    expect(result).toEqual({ saved: true });

    expect(storageFrom).toHaveBeenCalledWith("instructor-images");
    expect(upload).toHaveBeenCalledTimes(1);

    const inserted = insert.mock.calls[0][0] as {
      name: string;
      title: string;
      description_html: string | null;
      image_path: string | null;
      position: number;
    };
    expect(inserted.name).toBe("Sarah Lee");
    expect(inserted.title).toBe("Lead Instructor");
    expect(inserted.image_path).toEqual(expect.any(String));
    expect(inserted.description_html).toContain("<p>Hello</p>");
    expect(inserted.description_html?.toLowerCase()).not.toContain("script");
  });

  it("appends at the next position when the directory has instructors", async () => {
    lastPositionRow = { position: 4 };
    await createInstructor({}, form({ name: "Sarah" }));
    const inserted = insert.mock.calls[0][0] as { position: number };
    expect(inserted.position).toBe(5);
  });

  it("inserts with a null image_path and null description when omitted", async () => {
    const result = await createInstructor({}, form({ name: "Sarah" }));
    expect(result).toEqual({ saved: true });
    expect(upload).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toEqual({
      name: "Sarah",
      title: "Lead Instructor",
      description_html: null,
      image_path: null,
      position: 1,
    });
  });

  it("returns a save error when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    const result = await createInstructor({}, form({ name: "Sarah" }));
    expect(result).toEqual({ error: strings.instructorsSaveFailed });
  });
});
