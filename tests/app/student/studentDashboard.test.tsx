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

let student: { id: string; full_name: string | null } | null = null;
let waveRow: { name: string; description_html: string | null } | null = null;
let currentUser: { id: string; app_metadata?: Record<string, unknown> } = {
  id: "member-id",
};
// Rewards (feature 012): per-table action counts + the current point rules.
let counts: Record<string, number> = {
  wave_attendance: 0,
  wave_submissions: 0,
  wave_feedback: 0,
};
let pointRules: { action: string; points: number }[] = [];

const from = vi.fn((table: string) => {
  if (table === "point_rules") {
    return { select: async () => ({ data: pointRules }) };
  }
  if (table in counts) {
    // Count-only reads: select(…, { count, head }).eq(…)[.gte(…)] awaited
    // directly — model as a chainable thenable resolving { count }.
    const c: Record<string, unknown> = {};
    c.select = () => c;
    c.eq = () => c;
    c.gte = () => c;
    c.then = (resolve: (v: { count: number }) => void) =>
      resolve({ count: counts[table] });
    return c;
  }
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = () => b;
  // wave_weeks (buildStudentNav) is a list read terminated by .order()
  b.order = async () => ({ data: [] });
  b.maybeSingle = async () => ({
    data: table === "tenants" ? waveRow : student,
    error: null,
  });
  return b;
});
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  student = null;
  waveRow = null;
  currentUser = { id: "member-id" };
  counts = { wave_attendance: 0, wave_submissions: 0, wave_feedback: 0 };
  pointRules = [
    { action: "attendance", points: 10 },
    { action: "assignment", points: 20 },
    { action: "feedback", points: 30 },
  ];
  process.env.NEXT_PUBLIC_SITE_URL = "https://classroom.test";
});

import StudentDashboard from "@/app/student/dashboard/page";

describe("Student dashboard QR (US4.1)", () => {
  it("renders the member's QR code when their row exists", async () => {
    student = { id: "m1", full_name: "Mona" };
    render(await StudentDashboard());
    expect(screen.getByText(strings.studentQrTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: strings.studentQrAlt })
    ).toBeInTheDocument();
  });

  it("shows a placeholder (not a broken image) when there is no member row", async () => {
    student = null;
    render(await StudentDashboard());
    expect(screen.getByText(strings.studentQrPlaceholder)).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: strings.studentQrAlt })
    ).not.toBeInTheDocument();
  });

  it("shows zero points for a member with no rewarded actions (FR-022, US5)", async () => {
    student = { id: "m1", full_name: "Mona" };
    render(await StudentDashboard());
    expect(
      screen.getByText(`0 ${strings.studentRewardsPointsUnit}`)
    ).toBeInTheDocument();
  });

  it("derives the total as counts × current rules (1/1/1 under 10/20/30 → 60, US5)", async () => {
    student = { id: "m1", full_name: "Mona" };
    counts = { wave_attendance: 1, wave_submissions: 1, wave_feedback: 1 };
    render(await StudentDashboard());
    expect(
      screen.getByText(`60 ${strings.studentRewardsPointsUnit}`)
    ).toBeInTheDocument();
  });

  it("recomputes retroactively when a rule value changes (FR-029, US5)", async () => {
    student = { id: "m1", full_name: "Mona" };
    counts = { wave_attendance: 1, wave_submissions: 1, wave_feedback: 1 };
    pointRules = [
      { action: "attendance", points: 10 },
      { action: "assignment", points: 20 },
      { action: "feedback", points: 40 },
    ];
    render(await StudentDashboard());
    expect(
      screen.getByText(`70 ${strings.studentRewardsPointsUnit}`)
    ).toBeInTheDocument();
  });

  it("keeps the QR visible for an unassigned member whose wave was deleted", async () => {
    // The claim still points at the deleted wave; the tenants row is gone. The
    // member's own row stays readable (own-row RLS), so the QR must render —
    // while the wave section shows its empty state and queries no wave content.
    currentUser = { id: "member-id", app_metadata: { tenant_id: "dead-wave" } };
    student = { id: "m1", full_name: "Mona" };
    waveRow = null;
    render(await StudentDashboard());
    expect(
      screen.getByRole("img", { name: strings.studentQrAlt })
    ).toBeInTheDocument();
    expect(screen.getByText(strings.dashboardEmptyNote)).toBeInTheDocument();
  });
});
