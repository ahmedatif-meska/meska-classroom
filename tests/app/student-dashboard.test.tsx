import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/student/actions", () => ({ signOutStudent: vi.fn() }));

// Async server child — stub so RTL can render the page synchronously. Presence
// of the stub proves Home wires in the About-instructors section (its own list /
// empty-state rendering is covered by StudentInstructors.test.tsx).
vi.mock("@/components/StudentInstructors", () => ({
  default: () => <div data-testid="instructors" />,
}));

// Per-table chainable mock: maybeSingle() for single-row reads, order() for lists.
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
  id: "m1",
  full_name: "Mona",
};
let waveRow: { name: string; description_html: string | null } | null = {
  name: "July Cohort",
  description_html: null,
};
let weeks: { id: string; title: string | null; position: number }[] = [];

const from = vi.fn((table: string) => {
  if (table === "students") return makeBuilder({ single: studentRow });
  if (table === "tenants") return makeBuilder({ single: waveRow });
  if (table === "wave_weeks") return makeBuilder({ list: weeks });
  return makeBuilder({ list: [] });
});

const getUser = vi.fn(async () => ({
  data: {
    user: {
      id: "member-id",
      email: "mona@student.test",
      app_metadata: { tenant_id: "wave-A" },
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import StudentDashboard from "@/app/student/dashboard/page";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://classroom.test";
  studentRow = { id: "m1", full_name: "Mona" };
  waveRow = { name: "July Cohort", description_html: null };
  weeks = [];
});

describe("Student Home page", () => {
  it("renders the Student panel label in the sidebar", async () => {
    render(await StudentDashboard());
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
  });

  it("renders the Home nav item (renamed from Dashboard)", async () => {
    render(await StudentDashboard());
    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /dashboard/i })
    ).not.toBeInTheDocument();
  });

  it("greets the student by name with the 👋 emoji", async () => {
    render(await StudentDashboard());
    const heading = screen.getByRole("heading", { name: /welcome to mona/i });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain("👋");
  });

  it("falls back to the account email when the roster name is missing", async () => {
    studentRow = { id: "m1", full_name: null };
    render(await StudentDashboard());
    expect(
      screen.getByRole("heading", { name: /welcome to mona@student\.test/i })
    ).toBeInTheDocument();
  });

  it("labels the wave as 'You are in wave [name]'", async () => {
    render(await StudentDashboard());
    expect(screen.getByText(/you are in wave july cohort/i)).toBeInTheDocument();
  });

  it("renders the About instructors section", async () => {
    render(await StudentDashboard());
    expect(screen.getByTestId("instructors")).toBeInTheDocument();
  });

  it("shows no materials or assignments on Home", async () => {
    render(await StudentDashboard());
    expect(screen.queryByText(/upload submission/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^assignments$/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the QR section", async () => {
    render(await StudentDashboard());
    expect(
      screen.getByRole("heading", { name: /your qr code/i })
    ).toBeInTheDocument();
  });

  it("lists the wave's weeks in the Weeks nav group", async () => {
    weeks = [
      { id: "w1", title: null, position: 1 },
      { id: "w2", title: "Prompting", position: 2 },
    ];
    render(await StudentDashboard());
    // The Weeks group is collapsed on Home (no active week); expand it.
    fireEvent.click(screen.getByRole("button", { name: /weeks/i }));
    const week1 = screen.getByRole("link", { name: "Week 1" });
    expect(week1).toHaveAttribute("href", "/student/dashboard/weeks/w1");
    const week2 = screen.getByRole("link", { name: "Prompting" });
    expect(week2).toHaveAttribute("href", "/student/dashboard/weeks/w2");
  });

  it("contains no admin-panel link in the rendered chrome (panel isolation)", async () => {
    render(await StudentDashboard());
    const adminLinks = screen
      .queryAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("/admin"));
    expect(adminLinks).toHaveLength(0);
  });
});
