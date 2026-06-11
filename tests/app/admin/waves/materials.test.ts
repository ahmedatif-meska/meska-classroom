import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };

const insert = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));
const maybeSingle = vi.fn(async () => ({ data: { file_path: "w/wk/x.pdf" } }));
const deleteEq = vi.fn(async () => ({ error: null }));

const from = vi.fn(() => ({
  insert,
  select: () => ({ eq: () => ({ maybeSingle }) }),
  delete: () => ({ eq: deleteEq }),
}));
const storageFrom = vi.fn(() => ({ remove }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { addMaterial, removeMaterial, addAssignment } from "@/app/admin/waves/actions";

// The file bytes upload straight from the browser to Storage; the actions only
// receive the object's path and must verify it (wave id first — isolation).
const UUID = "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b";
const materialPath = (w: string, wk: string) => `${w}/${wk}/${UUID}.pdf`;
const assignmentPath = (w: string, wk: string) =>
  `${w}/${wk}/assignment-${UUID}.pdf`;

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  insert.mockResolvedValue({ error: null });
});

describe("addMaterial (US2.1)", () => {
  it("denies a non-admin", async () => {
    currentUser = null;
    const r = await addMaterial(
      {},
      fd({ wave_id: "w", week_id: "wk", title: "T", file_path: materialPath("w", "wk") })
    );
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a path outside the wave/week or with a bad extension (server-authoritative)", async () => {
    const outside = await addMaterial(
      {},
      fd({ wave_id: "w", week_id: "wk", title: "T", file_path: materialPath("other-wave", "wk") })
    );
    expect(outside).toEqual({ error: strings.wavesMaterialInvalid });

    const badExt = await addMaterial(
      {},
      fd({ wave_id: "w", week_id: "wk", title: "T", file_path: `w/wk/${UUID}.exe` })
    );
    expect(badExt).toEqual({ error: strings.wavesMaterialInvalid });
    expect(insert).not.toHaveBeenCalled();
  });

  it("records the wave/week path and inserts on success", async () => {
    const r = await addMaterial(
      {},
      fd({ wave_id: "w1", week_id: "wk9", title: " Slides ", file_path: materialPath("w1", "wk9") })
    );
    expect(r).toEqual({ saved: true });
    const row = insert.mock.calls[0][0] as {
      tenant_id: string;
      title: string;
      file_path: string;
    };
    expect(row.tenant_id).toBe("w1");
    expect(row.title).toBe("Slides");
    expect(row.file_path.startsWith("w1/wk9/")).toBe(true); // wave id first (isolation invariant)
  });

  it("cleans up the object when the row insert fails", async () => {
    insert.mockResolvedValue({ error: { message: "db" } });
    const r = await addMaterial(
      {},
      fd({ wave_id: "w", week_id: "wk", title: "T", file_path: materialPath("w", "wk") })
    );
    expect(r).toEqual({ error: strings.wavesMaterialSaveFailed });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([materialPath("w", "wk")]);
  });
});

describe("addAssignment (US2.2)", () => {
  it("requires the assignment- object-name prefix", async () => {
    const r = await addAssignment(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "hw.pdf", file_path: materialPath("w1", "wk1") })
    );
    expect(r).toEqual({ error: strings.wavesMaterialInvalid });
    expect(insert).not.toHaveBeenCalled();
  });

  it("records the path with the filename as title on success", async () => {
    const r = await addAssignment(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "hw.pdf", file_path: assignmentPath("w1", "wk1") })
    );
    expect(r).toEqual({ saved: true });
    const row = insert.mock.calls[0][0] as { title: string; file_path: string };
    expect(row.title).toBe("hw.pdf");
    expect(row.file_path).toBe(assignmentPath("w1", "wk1"));
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
