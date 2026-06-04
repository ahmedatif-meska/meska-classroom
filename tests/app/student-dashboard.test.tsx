import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/student/actions", () => ({ signOutStudent: vi.fn() }));

const maybeSingle = vi.fn(async () => ({
  data: { id: "m1", full_name: "Mona" },
  error: null,
}));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({ data: { user: { id: "member-id" } } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import StudentDashboard from "@/app/student/dashboard/page";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://classroom.test";
});

describe("Student dashboard page", () => {
  it("renders the Student panel label in the sidebar", async () => {
    render(await StudentDashboard());
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
  });

  it("renders the Dashboard nav item", async () => {
    render(await StudentDashboard());
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("renders the Dashboard heading", async () => {
    render(await StudentDashboard());
    expect(
      screen.getByRole("heading", { name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it("renders the student subtitle", async () => {
    render(await StudentDashboard());
    expect(screen.getByText(/student workspace/i)).toBeInTheDocument();
  });

  it("contains no admin-panel link in the rendered chrome (panel isolation)", async () => {
    render(await StudentDashboard());
    const adminLinks = screen
      .queryAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("/admin"));
    expect(adminLinks).toHaveLength(0);
  });
});
