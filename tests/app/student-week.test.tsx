import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/app/student/actions", () => ({ signOutStudent: vi.fn() }));

// notFound() throws (Next's real behavior) so we can assert the denial path.
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

// Async server child — stub so RTL renders synchronously and we can inspect props.
vi.mock("@/components/StudentWeekContent", () => ({
  default: ({
    tenantId,
    week,
    studentId,
  }: {
    tenantId: string;
    week: { id: string };
    studentId: string;
  }) => (
    <div data-testid="week-content">{`${tenantId}:${week.id}:${studentId}`}</div>
  ),
}));

type Result = { single?: unknown; list?: unknown[] };
function makeBuilder(result: Result) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.order = async () => ({ data: result.list ?? [] });
  b.maybeSingle = async () => ({ data: result.single ?? null });
  return b;
}

let studentRow: { id: string; full_name: string | null } | null = {
  id: "stu1",
  full_name: "Mona",
};
let weekRow: { id: string } | null = { id: "w1" };

const from = vi.fn((table: string) => {
  if (table === "students") return makeBuilder({ single: studentRow });
  if (table === "wave_weeks") return makeBuilder({ single: weekRow, list: [] });
  return makeBuilder({ list: [] });
});

const getUser = vi.fn(async () => ({
  data: { user: { id: "user1", app_metadata: { tenant_id: "wave-A" } } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import StudentWeekPage from "@/app/student/dashboard/weeks/[weekId]/page";

beforeEach(() => {
  vi.clearAllMocks();
  studentRow = { id: "stu1", full_name: "Mona" };
  weekRow = { id: "w1" };
});

describe("Student week page", () => {
  it("renders the week content wired to the caller's wave, week, and student", async () => {
    render(await StudentWeekPage({ params: Promise.resolve({ weekId: "w1" }) }));
    expect(screen.getByTestId("week-content")).toHaveTextContent(
      "wave-A:w1:stu1"
    );
  });

  it("calls notFound() for a week id that does not resolve in the caller's wave (cross-wave denial)", async () => {
    weekRow = null; // a wave-B week id never resolves under wave-A's RLS scope
    await expect(
      StudentWeekPage({ params: Promise.resolve({ weekId: "foreign-week" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound() when the student row is missing", async () => {
    studentRow = null;
    await expect(
      StudentWeekPage({ params: Promise.resolve({ weekId: "w1" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
