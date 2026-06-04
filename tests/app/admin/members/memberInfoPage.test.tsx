import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// AdminSidebarFooter imports a server action — stub it.
vi.mock("@/app/admin/actions", () => ({ signOutAdmin: vi.fn() }));

type Member = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  status: string;
  tenant: { name: string } | null;
} | null;

let member: Member = null;

const maybeSingle = vi.fn(async () => ({ data: member, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import MemberInfoPage from "@/app/admin/members/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Member information page (US4.1)", () => {
  it("renders the member's details for an admin", async () => {
    member = {
      id: "m1",
      full_name: "Mona Ali",
      whatsapp: "+201111111111",
      email: "mona@example.com",
      status: "active",
      tenant: { name: "Online" },
    };
    render(await MemberInfoPage({ params: Promise.resolve({ id: "m1" }) }));
    expect(screen.getByRole("heading", { name: "Mona Ali" })).toBeInTheDocument();
    expect(screen.getByText("+201111111111")).toBeInTheDocument();
    expect(screen.getByText("mona@example.com")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText(strings.membersStatusActive)).toBeInTheDocument();
  });

  it("shows not-found (no PII) when the row is not readable / missing", async () => {
    // A member session would be denied by RLS → no row → not-found, never PII.
    member = null;
    render(await MemberInfoPage({ params: Promise.resolve({ id: "nope" }) }));
    expect(screen.getByText(strings.memberNotFound)).toBeInTheDocument();
    // No member PII (field labels only render when a member row is present).
    expect(screen.queryByText(strings.memberWhatsappLabel)).not.toBeInTheDocument();
    expect(screen.queryByText("mona@example.com")).not.toBeInTheDocument();
  });
});
