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

type LogRow = {
  id: string;
  occurred_at: string;
  surface: string;
  origin: string;
  severity: string;
  operation: string;
  message: string;
  user_id: string | null;
  user_role: string | null;
};

let rows: LogRow[] = [];
let total = 0;
let rangeArgs: [number, number] | null = null;

const range = vi.fn(async (from: number, to: number) => {
  rangeArgs = [from, to];
  return { data: rows.slice(from, to + 1), count: total, error: null };
});
const order = vi.fn(() => ({ range }));
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
const getUser = vi.fn(async () => ({
  data: { user: { id: "admin-id", email: "ahmedatif@meska.ai" } },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import ErrorsPage from "@/app/admin/errors/page";

function makeRows(count: number): LogRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `log-${i + 1}`,
    // Newest first: log-1 is the most recent.
    occurred_at: new Date(Date.UTC(2026, 5, 10, 12, 0, 0) - i * 60_000).toISOString(),
    surface: "admin",
    origin: "server",
    severity: "error",
    operation: `operation-${i + 1}`,
    message: `message ${i + 1}`,
    user_id: "user-1",
    user_role: "admin",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  rangeArgs = null;
  rows = makeRows(60);
  total = rows.length;
});

describe("/admin/errors list page (US2.1)", () => {
  // Rendering a full 50-row page in jsdom can exceed the default 5s timeout
  // under full-suite CPU contention — the work is real, not a hang.
  it("renders the 50 newest entries with an Older link when more exist", { timeout: 20000 }, async () => {
    render(await ErrorsPage({ searchParams: Promise.resolve({}) }));

    expect(rangeArgs).toEqual([0, 49]);
    expect(screen.getAllByTestId("error-log-row")).toHaveLength(50);
    expect(screen.getByText("operation-1")).toBeInTheDocument();
    expect(screen.queryByText("operation-51")).not.toBeInTheDocument();

    const older = screen.getByRole("link", { name: strings.errorLogOlderLabel });
    expect(older).toHaveAttribute("href", "/admin/errors?page=2");
    expect(
      screen.queryByRole("link", { name: strings.errorLogNewerLabel })
    ).not.toBeInTheDocument();
  });

  it("serves page 2 with a Newer link and the remaining rows", async () => {
    render(await ErrorsPage({ searchParams: Promise.resolve({ page: "2" }) }));

    expect(rangeArgs).toEqual([50, 99]);
    expect(screen.getAllByTestId("error-log-row")).toHaveLength(10);
    const newer = screen.getByRole("link", { name: strings.errorLogNewerLabel });
    expect(newer).toHaveAttribute("href", "/admin/errors?page=1");
    expect(
      screen.queryByRole("link", { name: strings.errorLogOlderLabel })
    ).not.toBeInTheDocument();
  });

  it("falls back to page 1 on an invalid page param", async () => {
    render(await ErrorsPage({ searchParams: Promise.resolve({ page: "banana" }) }));
    expect(rangeArgs).toEqual([0, 49]);
  });

  it("shows the empty state when no errors are recorded", async () => {
    rows = [];
    total = 0;
    render(await ErrorsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(strings.errorLogEmptyNote)).toBeInTheDocument();
    expect(screen.queryByTestId("error-log-row")).not.toBeInTheDocument();
  });

  it("labels anonymous entries and links every row to its detail page", async () => {
    rows = makeRows(2);
    rows[1] = { ...rows[1], user_id: null, user_role: null };
    total = 2;
    render(await ErrorsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(strings.errorLogAnonymous)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: strings.errorLogViewLabel });
    expect(links[0]).toHaveAttribute("href", "/admin/errors/log-1");
    expect(links[1]).toHaveAttribute("href", "/admin/errors/log-2");
  });
});
