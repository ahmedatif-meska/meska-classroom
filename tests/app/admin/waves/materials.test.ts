import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };

const insert = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ data: { path: "x" }, error: null }));
const remove = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: { file_path: "w/wk/x.pdf" } }));
const deleteEq = vi.fn(async () => ({ error: null }));

const from = vi.fn(() => ({
  insert,
  select: () => ({ eq: () => ({ maybeSingle }) }),
  delete: () => ({ eq: deleteEq }),
}));
const storageFrom = vi.fn(() => ({ upload, remove }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { addMaterial, removeMaterial } from "@/app/admin/waves/actions";

const pdf = () =>
  new File([new Uint8Array(20)], "a.pdf", { type: "application/pdf" });

function fd(entries: Record<string, string>, file?: File) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  if (file) f.set("file", file);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  insert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ data: { path: "x" }, error: null });
});

describe("addMaterial (US2.1)", () => {
  it("denies a non-admin", async () => {
    currentUser = null;
    const r = await addMaterial({}, fd({ wave_id: "w", week_id: "wk", title: "T" }, pdf()));
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type with no upload (server-authoritative)", async () => {
    const exe = new File([new Uint8Array(10)], "a.exe", {
      type: "application/x-msdownload",
    });
    const r = await addMaterial({}, fd({ wave_id: "w", week_id: "wk", title: "T" }, exe));
    expect(r).toEqual({ error: strings.wavesMaterialInvalid });
    expect(upload).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("uploads to a wave/week path and inserts on success", async () => {
    const r = await addMaterial({}, fd({ wave_id: "w1", week_id: "wk9", title: " Slides " }, pdf()));
    expect(r).toEqual({ saved: true });
    expect(storageFrom).toHaveBeenCalledWith("wave-materials");
    const path = upload.mock.calls[0][0] as string;
    expect(path.startsWith("w1/wk9/")).toBe(true); // wave id first (isolation invariant)
    const row = insert.mock.calls[0][0] as { tenant_id: string; title: string };
    expect(row.tenant_id).toBe("w1");
    expect(row.title).toBe("Slides");
  });

  it("cleans up the object when the row insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db" } });
    const r = await addMaterial({}, fd({ wave_id: "w", week_id: "wk", title: "T" }, pdf()));
    expect(r).toEqual({ error: strings.wavesMaterialSaveFailed });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe("removeMaterial (US2.1)", () => {
  it("deletes the row and best-effort removes the object", async () => {
    const r = await removeMaterial({}, fd({ id: "m1", wave_id: "w1" }));
    expect(r).toEqual({ saved: true });
    expect(deleteEq).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["w/wk/x.pdf"]);
  });
});
