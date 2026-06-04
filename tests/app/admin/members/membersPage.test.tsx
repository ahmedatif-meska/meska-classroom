import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
vi.mock("@/app/admin/members/actions", () => ({
  createMember: vi.fn(),
  bulkCreateMembers: vi.fn(),
  resendMemberInvite: vi.fn(),
}));

type Student = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  created_at: string;
  tenant: { name: string } | null;
};

let students: Student[] = [];
const waves = [
  { id: "wave-offline", name: "Offline" },
  { id: "wave-online", name: "Online" },
];

const studentsOrder = vi.fn(async () => ({ data: students, error: null }));
const tenantsOrder = vi.fn(async () => ({ data: waves, error: null }));
const from = vi.fn((table: string) => ({
  select: vi.fn(() => ({
    order: table === "tenants" ? tenantsOrder : studentsOrder,
  })),
}));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import MembersPage from "@/app/admin/members/page";

beforeEach(() => {
  vi.clearAllMocks();
  students = [
    {
      id: "m1",
      full_name: "Mona Ali",
      whatsapp: "+201111111111",
      email: "mona@example.com",
      status: "active",
      created_at: "2026-06-01T00:00:00Z",
      tenant: { name: "Online" },
    },
    {
      id: "m2",
      full_name: "Sara Adel",
      whatsapp: "+201222222222",
      email: "sara@example.com",
      status: "pending",
      created_at: "2026-06-02T00:00:00Z",
      tenant: { name: "Offline" },
    },
  ];
});

describe("Members page (US1.1)", () => {
  it("renders a row per member with name, whatsapp, email, wave, and status", async () => {
    render(await MembersPage());
    expect(screen.getByText("Mona Ali")).toBeInTheDocument();
    expect(screen.getByText("Sara Adel")).toBeInTheDocument();
    expect(screen.getByText("mona@example.com")).toBeInTheDocument();
    expect(screen.getByText("+201222222222")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByText(strings.membersStatusActive)).toBeInTheDocument();
    expect(screen.getByText(strings.membersStatusPending)).toBeInTheDocument();
  });

  it("renders the Members nav entry, Add Members action, and the template download", async () => {
    render(await MembersPage());
    expect(
      screen.getByRole("link", { name: strings.membersNavLabel })
    ).toHaveAttribute("href", "/admin/members");
    expect(
      screen.getByRole("button", { name: strings.membersAddLabel })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.membersDownloadTemplate })
    ).toHaveAttribute("href", "/members-template.csv");
  });

  it("offers Resend invite only for pending members", async () => {
    render(await MembersPage());
    const resend = screen.getAllByRole("button", {
      name: strings.memberResendInviteLabel,
    });
    expect(resend).toHaveLength(1);
  });

  it("shows the empty state when there are no members", async () => {
    students = [];
    render(await MembersPage());
    expect(screen.getByText(strings.membersEmptyNote)).toBeInTheDocument();
  });
});
