import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import strings from "@/lib/strings";

// Mock next/link as a plain anchor.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stub the Server Actions so the client islands don't pull server-only deps.
vi.mock("@/app/admin/actions", () => ({
  createAdmin: vi.fn(),
  removeAdmin: vi.fn(),
  resendInvite: vi.fn(),
  signOutAdmin: vi.fn(),
}));

type Row = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string;
};

let rows: Row[] = [];
const CURRENT_ID = "current-admin-id";

const order = vi.fn(async () => ({ data: rows, error: null }));
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: CURRENT_ID, email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import AdminsPage from "@/app/admin/admins/page";

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    {
      id: CURRENT_ID,
      email: "ahmedatif@meska.ai",
      first_name: "Ahmed",
      last_name: "Atif",
      display_name: "ahmedatif",
      role: "admin",
      status: "active",
      created_at: "2026-05-17T00:00:00Z",
    },
    {
      id: "other-id",
      email: "newadmin@meska.ai",
      first_name: "New",
      last_name: "Admin",
      display_name: null,
      role: "admin",
      status: "pending",
      created_at: "2026-06-01T00:00:00Z",
    },
  ];
});

describe("Admin Management page (US1.1)", () => {
  it("renders a row per administrator with name, email, role, status, created", async () => {
    render(await AdminsPage());
    expect(screen.getByText("Ahmed Atif")).toBeInTheDocument();
    expect(screen.getByText("New Admin")).toBeInTheDocument();
    // The current admin's email appears in both their row and the sidebar footer.
    expect(screen.getAllByText("ahmedatif@meska.ai").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("newadmin@meska.ai")).toBeInTheDocument();
    expect(screen.getByText(strings.adminMgmtStatusActive)).toBeInTheDocument();
    expect(screen.getByText(strings.adminMgmtStatusPending)).toBeInTheDocument();
  });

  it("marks the current admin's own row with the You badge", async () => {
    render(await AdminsPage());
    expect(screen.getByText(strings.adminMgmtYouBadge)).toBeInTheDocument();
  });

  it("renders the Admin Management nav entry and the Add Admin action", async () => {
    render(await AdminsPage());
    expect(
      screen.getByRole("link", { name: strings.adminMgmtNavLabel })
    ).toHaveAttribute("href", "/admin/admins");
    expect(
      screen.getByRole("button", { name: strings.adminMgmtAddLabel })
    ).toBeInTheDocument();
  });

  it("renders the shared sidebar footer (email + sign out) consistently", async () => {
    render(await AdminsPage());
    expect(
      screen.getByRole("button", { name: /sign out/i })
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no administrators", async () => {
    rows = [];
    render(await AdminsPage());
    expect(screen.getByText(strings.adminMgmtEmptyNote)).toBeInTheDocument();
  });

  it("offers Resend invite only for pending rows", async () => {
    render(await AdminsPage());
    const resendButtons = screen.getAllByRole("button", {
      name: strings.resendInviteLabel,
    });
    expect(resendButtons).toHaveLength(1);
  });

  it("does not render a remove control on the current user's own row", async () => {
    render(await AdminsPage());
    // Two admins, but only the non-self row exposes a Remove control.
    const removeButtons = screen.getAllByRole("button", {
      name: new RegExp(strings.removeAdminSubmitLabel, "i"),
    });
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    expect(within(screen.getByText("Ahmed Atif").closest("[data-admin-row]")!).queryByRole("button", { name: new RegExp(strings.removeAdminSubmitLabel, "i") })).toBeNull();
  });
});
