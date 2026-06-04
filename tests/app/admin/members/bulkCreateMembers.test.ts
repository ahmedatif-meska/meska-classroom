import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> } | null;
let currentUser: User = null;
let existingEmails = new Set<string>();
let lastEmail = "";

const maybeSingle = vi.fn(async () => ({
  data: existingEmails.has(lastEmail) ? { id: "exists" } : null,
  error: null,
}));
const eq = vi.fn((_col: string, val: string) => {
  lastEmail = val;
  return { maybeSingle };
});
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

const createUser = vi.fn(async () => ({ data: { user: { id: "u-id" } }, error: null }));
const insert = vi.fn(async () => ({ error: null }));
const adminFrom = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { createUser } },
    from: adminFrom,
  })),
}));

const signInWithOtp = vi.fn(async () => ({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithOtp } })),
}));

import { bulkCreateMembers } from "@/app/admin/members/actions";

const HEADER = "Full Name,WhatsApp Number,Email";

function form(csv: string, wave: string | null) {
  const fd = new FormData();
  fd.set("file", new File([csv], "members.csv", { type: "text/csv" }));
  if (wave !== null) fd.set("wave_id", wave);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-id", app_metadata: { role: "admin" } };
  existingEmails = new Set();
  createUser.mockResolvedValue({ data: { user: { id: "u-id" } }, error: null });
});

describe("bulkCreateMembers (US5.1)", () => {
  it("denies a non-admin caller before any creation (FR-028)", async () => {
    currentUser = null;
    const result = await bulkCreateMembers(
      {},
      form(`${HEADER}\nMona,+201,m@x.com\n`, "w1")
    );
    expect(result).toEqual({ error: strings.memberMgmtForbidden });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects the whole file on a blank cell and creates nothing (FR-012)", async () => {
    const result = await bulkCreateMembers(
      {},
      form(`${HEADER}\nMona,+201,m@x.com\nSara, ,sara@x.com\n`, "w1")
    );
    expect(result.error).toContain(strings.bulkBlankCell);
    expect(result.createdCount).toBeUndefined();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates each valid row and skips in-file and existing duplicates (FR-014/FR-015)", async () => {
    existingEmails = new Set(["c@x.com"]);
    const csv = `${HEADER}\nA,+201,a@x.com\nB,+202,b@x.com\nA2,+203,a@x.com\nC,+204,c@x.com\n`;
    const result = await bulkCreateMembers({}, form(csv, "w1"));

    expect(result.createdCount).toBe(2); // a@x.com, b@x.com
    expect(createUser).toHaveBeenCalledTimes(2);
    const skipped = result.results?.filter((r) => !r.created) ?? [];
    expect(skipped.map((r) => r.email).sort()).toEqual(["a@x.com", "c@x.com"]);
  });
});
