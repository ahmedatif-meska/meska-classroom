import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/app/student/actions", () => ({ signOutStudent: vi.fn() }));

let student: { id: string; full_name: string | null } | null = null;

const maybeSingle = vi.fn(async () => ({ data: student, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({ data: { user: { id: "member-id" } } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
});
