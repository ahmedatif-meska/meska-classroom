import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/app/student/actions", () => ({ signOutStudent: vi.fn() }));
// Async server child — stub so RTL can render the page synchronously.
vi.mock("@/components/StudentInstructors", () => ({
  default: () => <div data-testid="instructors" />,
}));

// Per-table chainable mock: maybeSingle() for single-row reads, order() for lists.
type Result = { single?: unknown; list?: unknown[] };
function makeBuilder(result: Result) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.gte = () => b; // points count reads (feature 012) — awaited directly, count undefined → 0
  b.order = async () => ({ data: result.list ?? [] });
  b.maybeSingle = async () => ({ data: result.single ?? null });
  return b;
}

let waveRow: { name: string; description_html: string | null } | null = null;

const from = vi.fn((table: string) => {
  if (table === "students")
    return makeBuilder({ single: { id: "stu1", full_name: "Mona" } });
  if (table === "tenants") return makeBuilder({ single: waveRow });
  return makeBuilder({ list: [] }); // wave_weeks
});

const getUser = vi.fn(async () => ({
  data: { user: { id: "user1", app_metadata: { tenant_id: "wave-A" } } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import StudentDashboard from "@/app/student/dashboard/page";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = "https://classroom.test";
  waveRow = null;
});

describe("Student Home — wave label & description (US1.1)", () => {
  it("labels the enrolled wave by name and renders its description", async () => {
    waveRow = { name: "July", description_html: "<p>Welcome to July</p>" };
    render(await StudentDashboard());
    expect(
      screen.getByText(strings.studentHomeCurrentWaveLabel)
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "July" })).toBeInTheDocument();
    expect(screen.getByText("Welcome to July")).toBeInTheDocument();
  });

  it("shows an empty state when the wave has no description", async () => {
    waveRow = { name: "July", description_html: null };
    render(await StudentDashboard());
    expect(screen.getByText(strings.dashboardEmptyNote)).toBeInTheDocument();
  });

  it("shows the no-wave note when the student is unassigned", async () => {
    waveRow = null;
    render(await StudentDashboard());
    expect(screen.getByText(strings.studentNoWaveNote)).toBeInTheDocument();
  });
});
