import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

// SubmitAssignment is a client island with its own deps — stub it here.
vi.mock("@/components/SubmitAssignment", () => ({
  default: ({ assignmentId }: { assignmentId: string }) => (
    <div data-testid={`submit-${assignmentId}`} />
  ),
}));

type Result = { list?: unknown[] };
function makeBuilder(result: Result) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.order = async () => ({ data: result.list ?? [] });
  // Awaiting the builder directly (no .order) resolves to the list too.
  b.then = (resolve: (v: { data: unknown[] }) => unknown) =>
    Promise.resolve({ data: result.list ?? [] }).then(resolve);
  return b;
}

let materials: { id: string; title: string; file_path: string }[] = [];
let assignments: {
  id: string;
  title: string;
  file_path: string | null;
  instructions_html: string | null;
  due_at: string | null;
}[] = [];
let submissions: { assignment_id: string }[] = [];
// Signed URL: null simulates a foreign / unauthorized path (no download link).
let signUrl: string | null = "https://files.test/signed";

const from = vi.fn((table: string) => {
  if (table === "wave_materials") return makeBuilder({ list: materials });
  if (table === "wave_assignments") return makeBuilder({ list: assignments });
  if (table === "wave_submissions") return makeBuilder({ list: submissions });
  return makeBuilder({ list: [] });
});

const createSignedUrl = vi.fn(async () => ({
  data: signUrl ? { signedUrl: signUrl } : null,
  error: signUrl ? null : { message: "denied" },
}));
const storage = { from: () => ({ createSignedUrl }) };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, storage })),
}));

import StudentWeekContent, { type Week } from "@/components/StudentWeekContent";

const week: Week = {
  id: "w1",
  title: "Prompting",
  position: 1,
  description_html: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  materials = [];
  assignments = [];
  submissions = [];
  signUrl = "https://files.test/signed";
});

describe("StudentWeekContent", () => {
  it("renders the week title and the Resources & Assignments disclosures", async () => {
    render(
      await StudentWeekContent({ tenantId: "wave-A", week, studentId: "stu1" })
    );
    expect(
      screen.getByRole("heading", { name: "Prompting" })
    ).toBeInTheDocument();
    expect(screen.getByText(strings.studentResourcesLabel)).toBeInTheDocument();
    expect(
      screen.getByText(strings.studentAssignmentsLabel)
    ).toBeInTheDocument();
  });

  it("lists a material as a download link when a signed URL is issued", async () => {
    materials = [{ id: "m1", title: "Slides", file_path: "wave-A/w1/x.pdf" }];
    render(
      await StudentWeekContent({ tenantId: "wave-A", week, studentId: "stu1" })
    );
    const link = screen.getByRole("link", { name: /slides/i });
    expect(link).toHaveAttribute("href", "https://files.test/signed");
  });

  it("renders a material as plain text (no link) when the signed URL is null (foreign/unauthorized path)", async () => {
    materials = [{ id: "m1", title: "Slides", file_path: "wave-B/x/x.pdf" }];
    signUrl = null;
    render(
      await StudentWeekContent({ tenantId: "wave-A", week, studentId: "stu1" })
    );
    expect(screen.queryByRole("link", { name: /slides/i })).not.toBeInTheDocument();
    expect(screen.getByText("Slides")).toBeInTheDocument();
  });

  it("renders an assignment with its submit control", async () => {
    assignments = [
      {
        id: "a1",
        title: "Task 1",
        file_path: null,
        instructions_html: null,
        due_at: null,
      },
    ];
    render(
      await StudentWeekContent({ tenantId: "wave-A", week, studentId: "stu1" })
    );
    expect(screen.getByText("Task 1")).toBeInTheDocument();
    expect(screen.getByTestId("submit-a1")).toBeInTheDocument();
  });

  it("shows empty states when the week has no materials or assignments", async () => {
    render(
      await StudentWeekContent({ tenantId: "wave-A", week, studentId: "stu1" })
    );
    expect(screen.getByText(strings.studentWeekNoMaterials)).toBeInTheDocument();
    expect(
      screen.getByText(strings.studentWeekNoAssignments)
    ).toBeInTheDocument();
  });
});
