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
vi.mock("@/components/StudentWaveContent", () => ({
  default: ({ tenantId, studentId }: { tenantId: string; studentId: string }) => (
    <div data-testid="wave-content">{`${tenantId}:${studentId}`}</div>
  ),
}));

// Per-table chainable mock: maybeSingle() for single-row reads, thenable for lists.
type Result = { single?: unknown; list?: unknown[] };
function chain(result: Result) {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  b.order = () => b;
  b.maybeSingle = async () => ({ data: result.single ?? null });
  b.then = (resolve: (v: { data: unknown[] }) => unknown) =>
    Promise.resolve({ data: result.list ?? [] }).then(resolve);
  return b;
}

let waveRow: { name: string; description_html: string | null } | null = null;

const from = vi.fn((table: string) => {
  if (table === "students")
    return chain({ single: { id: "stu1", full_name: "Mona" } });
  if (table === "tenants") return chain({ single: waveRow });
  return chain({ list: [] }); // wave_weeks / materials / assignments / submissions
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

describe("Student dashboard — wave description (US1.2)", () => {
  it("renders the enrolled wave's description with its formatting", async () => {
    waveRow = { name: "July", description_html: "<p>Welcome to July</p>" };
    render(await StudentDashboard());
    expect(screen.getByText(strings.studentWaveSectionTitle)).toBeInTheDocument();
    expect(screen.getByText("Welcome to July")).toBeInTheDocument();
    // The wave content child is wired with the caller's wave + student id.
    expect(screen.getByTestId("wave-content")).toHaveTextContent("wave-A:stu1");
  });

  it("shows an empty state when the wave has no description", async () => {
    waveRow = { name: "July", description_html: null };
    render(await StudentDashboard());
    expect(screen.getByText(strings.dashboardEmptyNote)).toBeInTheDocument();
  });
});
