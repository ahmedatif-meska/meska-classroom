import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let student: { id: string } | null = { id: "stu-1" };
let assignment: { id: string } | null = { id: "asg-1" };

const upsert = vi.fn(async () => ({ error: null }));
const upload = vi.fn(async () => ({ data: { path: "p" }, error: null }));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

const from = vi.fn((table: string) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: async () => ({
        data: table === "students" ? student : assignment,
      }),
    }),
  }),
  upsert,
}));
const storageFrom = vi.fn(() => ({ upload }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
    storage: { from: storageFrom },
  })),
}));

import { submitAssignment } from "@/app/student/dashboard/actions";

const pdf = () =>
  new File([new Uint8Array(20)], "s.pdf", { type: "application/pdf" });

function fd(entries: Record<string, string>, file?: File) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  if (file) f.set("file", file);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = {
    id: "user-1",
    app_metadata: { role: "student", tenant_id: "wave-A" },
  };
  student = { id: "stu-1" };
  assignment = { id: "asg-1" };
  upsert.mockResolvedValue({ error: null });
  upload.mockResolvedValue({ data: { path: "p" }, error: null });
});

describe("submitAssignment (US3.2)", () => {
  it("denies a non-student (e.g. admin token)", async () => {
    currentUser = { id: "a", app_metadata: { role: "admin", tenant_id: "wave-A" } };
    const r = await submitAssignment({}, fd({ assignment_id: "asg-1" }, pdf()));
    expect(r).toEqual({ error: strings.studentForbidden });
    expect(upload).not.toHaveBeenCalled();
  });

  it("denies when there is no tenant claim", async () => {
    currentUser = { id: "u", app_metadata: { role: "student" } };
    const r = await submitAssignment({}, fd({ assignment_id: "asg-1" }, pdf()));
    expect(r).toEqual({ error: strings.studentForbidden });
  });

  it("rejects an unsupported file type", async () => {
    const png = new File([new Uint8Array(10)], "x.png", { type: "image/png" });
    const r = await submitAssignment({}, fd({ assignment_id: "asg-1" }, png));
    expect(r).toEqual({ error: strings.studentSubmissionInvalid });
    expect(upload).not.toHaveBeenCalled();
  });

  it("denies submitting to an assignment outside the caller's wave (cross-wave denial)", async () => {
    assignment = null; // RLS would not return another wave's assignment
    const r = await submitAssignment({}, fd({ assignment_id: "other-wave-asg" }, pdf()));
    expect(r).toEqual({ error: strings.studentForbidden });
    expect(upload).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("uploads to a wave/assignment/student path and upserts on success", async () => {
    const r = await submitAssignment({}, fd({ assignment_id: "asg-1" }, pdf()));
    expect(r).toEqual({ saved: true });
    expect(storageFrom).toHaveBeenCalledWith("assignment-submissions");
    const path = upload.mock.calls[0][0] as string;
    expect(path).toBe("wave-A/asg-1/stu-1/submission.pdf"); // wave first, student third
    const [row, opts] = upsert.mock.calls[0] as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(row.tenant_id).toBe("wave-A");
    expect(row.student_id).toBe("stu-1");
    expect(opts.onConflict).toBe("assignment_id,student_id");
  });
});
