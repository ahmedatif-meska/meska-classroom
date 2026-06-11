import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/errors/log", () => ({ logError: vi.fn(async () => {}) }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = { id: "c", app_metadata: { role: "admin" } };
let insertError: unknown = null;
let deleteError: unknown = null;
let updateError: unknown = null;
let lastPositionRow: { position: number } | null = null;
let weekRows: { id: string; position: number }[] = [];

const insert = vi.fn(async () => ({ error: insertError }));
const deleteEq = vi.fn(async () => ({ error: deleteError }));
const updateEq = vi.fn(async () => ({ error: updateError }));
const update = vi.fn(() => ({ eq: updateEq }));
const maybeSingle = vi.fn(async () => ({ data: lastPositionRow, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

// order() is both awaitable (reorder list query → { data: weekRows }) and carries
// .limit().maybeSingle() (addVideo position lookup).
function orderResult() {
  const p = Promise.resolve({ data: weekRows, error: null });
  return Object.assign(p, { limit: () => ({ maybeSingle }) });
}
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ order: () => orderResult() }) }),
  insert,
  update,
  delete: () => ({ eq: deleteEq }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import {
  addVideo,
  removeVideo,
  updateVideo,
  reorderVideo,
} from "@/app/admin/waves/actions";

const ID = "1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvW";
const link = `https://drive.google.com/file/d/${ID}/view?usp=sharing`;

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "c", app_metadata: { role: "admin" } };
  insertError = null;
  deleteError = null;
  updateError = null;
  lastPositionRow = null;
  weekRows = [];
});

describe("addVideo (US1)", () => {
  it("denies a non-admin and writes nothing", async () => {
    currentUser = null;
    const r = await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "Intro", drive_link: link })
    );
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a non-Drive link", async () => {
    const r = await addVideo(
      {},
      fd({
        wave_id: "w1",
        week_id: "wk1",
        title: "Intro",
        drive_link: "https://example.com/video",
      })
    );
    expect(r).toEqual({ error: strings.wavesVideoLinkInvalid });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an empty or over-long title", async () => {
    const empty = await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "   ", drive_link: link })
    );
    expect(empty).toEqual({ error: strings.wavesVideoTitleRequired });

    const tooLong = await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "x".repeat(201), drive_link: link })
    );
    expect(tooLong).toEqual({ error: strings.wavesVideoTitleRequired });
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores the parsed file id (not the raw URL) at the next position on success", async () => {
    lastPositionRow = { position: 3 };
    const r = await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk9", title: " Lesson 1 ", drive_link: link })
    );
    expect(r).toEqual({ saved: true });
    const row = insert.mock.calls[0][0] as {
      tenant_id: string;
      week_id: string;
      title: string;
      drive_file_id: string;
      position: number;
    };
    expect(row.tenant_id).toBe("w1");
    expect(row.week_id).toBe("wk9");
    expect(row.title).toBe("Lesson 1");
    expect(row.drive_file_id).toBe(ID);
    expect(row.position).toBe(4);
  });

  it("starts at position 1 when the week has no videos", async () => {
    lastPositionRow = null;
    await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "First", drive_link: link })
    );
    const row = insert.mock.calls[0][0] as { position: number };
    expect(row.position).toBe(1);
  });

  it("returns a save error when the insert fails", async () => {
    insertError = { message: "db" };
    const r = await addVideo(
      {},
      fd({ wave_id: "w1", week_id: "wk1", title: "Intro", drive_link: link })
    );
    expect(r).toEqual({ error: strings.wavesVideoSaveFailed });
  });
});

describe("removeVideo (US1)", () => {
  it("denies a non-admin and deletes nothing", async () => {
    currentUser = null;
    const r = await removeVideo({}, fd({ id: "v1", wave_id: "w1" }));
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("deletes the targeted row on success", async () => {
    const r = await removeVideo({}, fd({ id: "v1", wave_id: "w1" }));
    expect(r).toEqual({ saved: true });
    expect(deleteEq).toHaveBeenCalledTimes(1);
  });
});

describe("updateVideo (US3)", () => {
  it("denies a non-admin and writes nothing", async () => {
    currentUser = null;
    const r = await updateVideo(
      {},
      fd({ id: "v1", wave_id: "w1", title: "T", drive_link: link })
    );
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(update).not.toHaveBeenCalled();
  });

  it("re-stores the re-parsed file id on success", async () => {
    const r = await updateVideo(
      {},
      fd({ id: "v1", wave_id: "w1", title: " Renamed ", drive_link: link })
    );
    expect(r).toEqual({ saved: true });
    const payload = update.mock.calls[0][0] as {
      title: string;
      drive_file_id: string;
    };
    expect(payload.title).toBe("Renamed");
    expect(payload.drive_file_id).toBe(ID);
  });

  it("rejects a non-Drive link and leaves the row unchanged", async () => {
    const r = await updateVideo(
      {},
      fd({ id: "v1", wave_id: "w1", title: "T", drive_link: "https://x.com/y" })
    );
    expect(r).toEqual({ error: strings.wavesVideoLinkInvalid });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("reorderVideo (US3)", () => {
  it("denies a non-admin and writes nothing", async () => {
    currentUser = null;
    const r = await reorderVideo(
      {},
      fd({ id: "a", wave_id: "w1", week_id: "wk1", direction: "down" })
    );
    expect(r).toEqual({ error: strings.wavesForbidden });
    expect(update).not.toHaveBeenCalled();
  });

  it("swaps positions with the adjacent video", async () => {
    weekRows = [
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ];
    const r = await reorderVideo(
      {},
      fd({ id: "a", wave_id: "w1", week_id: "wk1", direction: "down" })
    );
    expect(r).toEqual({ saved: true });
    expect(update).toHaveBeenCalledTimes(2); // two position swaps
  });

  it("is a no-op at the ends", async () => {
    weekRows = [
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ];
    const r = await reorderVideo(
      {},
      fd({ id: "a", wave_id: "w1", week_id: "wk1", direction: "up" })
    );
    expect(r).toEqual({ saved: true });
    expect(update).not.toHaveBeenCalled();
  });
});
