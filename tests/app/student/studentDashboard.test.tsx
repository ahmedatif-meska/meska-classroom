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
let waveRow: { name: string; description_html: string | null } | null = null;
let currentUser: { id: string; app_metadata?: Record<string, unknown> } = {
  id: "member-id",
};

const from = vi.fn((table: string) => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: table === "tenants" ? waveRow : student,
        error: null,
      })),
    })),
  })),
}));
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  student = null;
  waveRow = null;
  currentUser = { id: "member-id" };
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
