import { describe, it, expect, vi, beforeEach } from "vitest";
import strings from "@/lib/strings";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type User = { id: string; app_metadata?: Record<string, unknown> };
let currentUser: User | null = null;
let student: { id: string } | null = { id: "stu-1" };
let assignment: { id: string } | null = { id: "asg-1" };

const upsert = vi.fn(async () => ({ error: null }));
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    from,
  })),
}));

import { submitAssignment } from "@/app/student/dashboard/actions";

// The file bytes upload straight from the browser to Storage; the action only
// receives the object's path and must verify it is the caller's OWN slot.
const OWN_PATH = "wave-A/asg-1/stu-1/submission.pdf";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
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
});

describe("submitAssignment (US3.2)", () => {
  it("denies a non-student (e.g. admin token)", async () => {
    currentUser = { id: "a", app_metadata: { role: "admin", tenant_id: "wave-A" } };
    const r = await submitAssignment(
      {},
      fd({ assignment_id: "asg-1", file_path: OWN_PATH })
    );
    expect(r).toEqual({ error: strings.studentForbidden });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("denies when there is no tenant claim", async () => {
    currentUser = { id: "u", app_metadata: { role: "student" } };
    const r = await submitAssignment(
      {},
      fd({ assignment_id: "asg-1", file_path: OWN_PATH })
    );
    expect(r).toEqual({ error: strings.studentForbidden });
  });

  it("rejects a path that is not the caller's own submission slot", async () => {
    const otherStudent = await submitAssignment(
      {},
      fd({ assignment_id: "asg-1", file_path: "wave-A/asg-1/stu-2/submission.pdf" })
    );
    expect(otherStudent).toEqual({ error: strings.studentSubmissionInvalid });

    const badExt = await submitAssignment(
      {},
      fd({ assignment_id: "asg-1", file_path: "wave-A/asg-1/stu-1/submission.png" })
    );
    expect(badExt).toEqual({ error: strings.studentSubmissionInvalid });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("denies submitting to an assignment outside the caller's wave (cross-wave denial)", async () => {
    assignment = null; // RLS would not return another wave's assignment
    const r = await submitAssignment(
      {},
      fd({ assignment_id: "other-wave-asg", file_path: OWN_PATH })
    );
    expect(r).toEqual({ error: strings.studentForbidden });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the caller's own wave/assignment/student path on success", async () => {
    const r = await submitAssignment(
      {},
      fd({ assignment_id: "asg-1", file_path: OWN_PATH })
    );
    expect(r).toEqual({ saved: true });
    const [row, opts] = upsert.mock.calls[0] as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(row.tenant_id).toBe("wave-A");
    expect(row.student_id).toBe("stu-1");
    expect(row.file_path).toBe(OWN_PATH); // wave first, student third
    expect(opts.onConflict).toBe("assignment_id,student_id");
  });
});
