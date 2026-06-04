import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;

const getUser = vi.fn(async () => ({ data: { user: currentUser } }));
const insert = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
const remove = vi.fn(async () => ({ data: null, error: null }));
const from = vi.fn(() => ({ insert }));
const storageFrom = vi.fn(() => ({ upload, remove }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { createInstructor } from "@/app/admin/instructors/actions";

function form(opts: { name?: string | null; description?: string; image?: File }) {
  const fd = new FormData();
  if (opts.name !== null && opts.name !== undefined) fd.set("name", opts.name);
  if (opts.description !== undefined) fd.set("description_html", opts.description);
  if (opts.image) fd.set("image", opts.image);
  return fd;
}

const pngFile = () =>
  new File([new Uint8Array(20)], "a.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "caller", app_metadata: { role: "admin" } };
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
      description_html: string | null;
      image_path: string | null;
    };
    expect(inserted.name).toBe("Sarah Lee");
    expect(inserted.image_path).toEqual(expect.any(String));
    expect(inserted.description_html).toContain("<p>Hello</p>");
    expect(inserted.description_html?.toLowerCase()).not.toContain("script");
  });

  it("inserts with a null image_path and null description when omitted", async () => {
    const result = await createInstructor({}, form({ name: "Sarah" }));
    expect(result).toEqual({ saved: true });
    expect(upload).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0]).toEqual({
      name: "Sarah",
      description_html: null,
      image_path: null,
    });
  });

  it("returns a save error when the insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db down" } });
    const result = await createInstructor({}, form({ name: "Sarah" }));
    expect(result).toEqual({ error: strings.instructorsSaveFailed });
  });
});
