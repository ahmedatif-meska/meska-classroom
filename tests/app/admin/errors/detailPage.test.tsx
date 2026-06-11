import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

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

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

type LogRow = {
  id: string;
  occurred_at: string;
  surface: string;
  origin: string;
  severity: string;
  operation: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  user_role: string | null;
  tenant_id: string | null;
  environment: string | null;
};

let row: LogRow | null = null;

const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import ErrorDetailPage from "@/app/admin/errors/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
  row = {
    id: "log-1",
    occurred_at: "2026-06-10T12:00:00.000Z",
    surface: "admin",
    origin: "server",
    severity: "error",
    operation: "createInstructor",
    message: "column does not exist",
    stack: "PostgrestError: column does not exist\n  at insert",
    context: { id: "instructor-9" },
    user_id: "user-1",
    user_role: "admin",
    tenant_id: null,
    environment: "production",
  };
});

describe("/admin/errors/[id] detail page (US2.1)", () => {
  it("renders every stored field", async () => {
    render(await ErrorDetailPage({ params: Promise.resolve({ id: "log-1" }) }));

    expect(screen.getByText("createInstructor")).toBeInTheDocument();
    expect(screen.getByText("column does not exist")).toBeInTheDocument();
    expect(screen.getByText(/PostgrestError/)).toBeInTheDocument();
    expect(screen.getByText(/instructor-9/)).toBeInTheDocument();
    expect(screen.getAllByText("admin").length).toBeGreaterThan(0); // surface + role
    expect(screen.getByText("server")).toBeInTheDocument(); // origin
    expect(screen.getByText("error")).toBeInTheDocument(); // severity
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("user-1")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.errorLogDetailBackLabel })
    ).toHaveAttribute("href", "/admin/errors");
  });

  it("labels an anonymous entry and survives null stack/context", async () => {
    row = {
      ...row!,
      user_id: null,
      user_role: null,
      stack: null,
      context: null,
    };
    render(await ErrorDetailPage({ params: Promise.resolve({ id: "log-1" }) }));

    expect(screen.getByText(strings.errorLogAnonymous)).toBeInTheDocument();
    expect(screen.getByText(strings.errorLogNoStack)).toBeInTheDocument();
    expect(screen.getByText(strings.errorLogNoContext)).toBeInTheDocument();
  });

  it("calls notFound() for an unknown id", async () => {
    row = null;
    await expect(
      ErrorDetailPage({ params: Promise.resolve({ id: "nope" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
