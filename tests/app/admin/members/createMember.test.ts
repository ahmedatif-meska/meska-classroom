import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown>; email?: string };
let currentUser: User | null = null;
let existingStudent: { id: string } | null = null;

const maybeSingle = vi.fn(async () => ({ data: existingStudent, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));

// Service-role Admin API (createUser + students insert).
const createUser = vi.fn();
const insert = vi.fn(async () => ({ error: null }));
const adminFrom = vi.fn(() => ({ insert }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { createUser } },
    from: adminFrom,
  })),
}));

// Isolated anon client used to send the Magic Link onboarding email.
const signInWithOtp = vi.fn(async () => ({ error: null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { signInWithOtp } })),
}));

import { createMember } from "@/app/admin/members/actions";

function form(
  name: string | null,
  whatsapp: string | null,
  email: string | null,
  wave: string | null
) {
  const fd = new FormData();
  if (name !== null) fd.set("full_name", name);
  if (whatsapp !== null) fd.set("whatsapp", whatsapp);
  if (email !== null) fd.set("email", email);
  if (wave !== null) fd.set("wave_id", wave);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-id", app_metadata: { role: "admin" }, email: "a@x.com" };
  existingStudent = null;
  createUser.mockResolvedValue({ data: { user: { id: "new-id" } }, error: null });
  insert.mockResolvedValue({ error: null });
  signInWithOtp.mockResolvedValue({ error: null });
});

describe("createMember (US2.1)", () => {
  it("denies a non-admin caller before any Admin-API call (FR-028)", async () => {
    currentUser = null;
    const result = await createMember({}, form("Mona", "+201", "m@x.com", "w1"));
    expect(result).toEqual({ error: strings.memberMgmtForbidden });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("blocks invalid fields before any backend call (FR-008)", async () => {
    const result = await createMember({}, form("", "+201", "m@x.com", "w1"));
    expect(result).toEqual({ error: strings.memberMgmtNameRequired });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("rejects a duplicate member email without creating (FR-009)", async () => {
    existingStudent = { id: "exists" };
    const result = await createMember({}, form("Mona", "+201", "dupe@x.com", "w1"));
    expect(result).toEqual({ error: strings.memberMgmtEmailInUse });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("creates the user with student+tenant claims, inserts a pending row, sends a magic link, and audits (FR-010)", async () => {
    const result = await createMember({}, form("Mona Ali", "+201", "Mona@X.com", "w1"));
    expect(result).toEqual({ created: true, inviteFailed: false });

    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "mona@x.com",
        email_confirm: true,
        user_metadata: { full_name: "Mona Ali", whatsapp: "+201" },
        app_metadata: { role: "student", tenant_id: "w1" },
      })
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "new-id",
        email: "mona@x.com",
        whatsapp: "+201",
        full_name: "Mona Ali",
        tenant_id: "w1",
        student_code: "mona@x.com",
        status: "pending",
      })
    );
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "mona@x.com",
        options: expect.objectContaining({
          shouldCreateUser: false,
          emailRedirectTo: expect.stringContaining("/student/auth/confirm"),
        }),
      })
    );
    expect(rpc).toHaveBeenCalledWith("log_admin_auth_event", {
      p_email: "mona@x.com",
      p_outcome: "success",
      p_reason: "member_created",
    });
  });

  it("still creates the pending member but reports inviteFailed when the magic link send errors (FR-027)", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "smtp down" } });
    const result = await createMember({}, form("Mona", "+201", "m@x.com", "w1"));
    expect(result).toEqual({ created: true, inviteFailed: true });
    expect(insert).toHaveBeenCalled();
  });

  it("maps an already-registered email to the in-use error", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    const result = await createMember({}, form("Mona", "+201", "m@x.com", "w1"));
    expect(result).toEqual({ error: strings.memberMgmtEmailInUse });
    expect(insert).not.toHaveBeenCalled();
  });
});
