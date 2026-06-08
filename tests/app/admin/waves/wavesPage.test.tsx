import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type Wave = {
  id: string;
  name: string;
  description_html: string | null;
  type: "online" | "offline";
  created_at: string;
};
let waves: Wave[] = [];
let weeks: { tenant_id: string }[] = [];

const getUser = vi.fn(async () => ({ data: { user: { email: "a@b.c" } } }));
const from = vi.fn((table: string) => {
  if (table === "tenants") {
    return { select: () => ({ order: async () => ({ data: waves }) }) };
  }
  return { select: async () => ({ data: weeks }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));

import WavesPage from "@/app/admin/waves/page";

beforeEach(() => {
  vi.clearAllMocks();
  waves = [];
  weeks = [];
});

describe("WavesPage (US1.1)", () => {
  it("shows the empty state and a create action when there are no waves", async () => {
    render(await WavesPage());
    expect(screen.getByText(strings.wavesEmptyNote)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.wavesAddLabel })
    ).toBeInTheDocument();
  });

  it("renders waves newest-first as cards with their type", async () => {
    waves = [
      { id: "w2", name: "September", description_html: null, type: "offline", created_at: "2026-09-01" },
      { id: "w1", name: "July", description_html: "<p>Hi</p>", type: "online", created_at: "2026-07-01" },
    ];
    weeks = [{ tenant_id: "w1" }, { tenant_id: "w1" }];
    render(await WavesPage());

    const cards = screen.getAllByRole("link", { name: /September|July/ });
    expect(cards[0]).toHaveTextContent("September"); // page passes order desc from the query
    expect(screen.getByText("July")).toBeInTheDocument();
    expect(screen.getByText(strings.waveTypeOnline)).toBeInTheDocument();
    expect(screen.getByText(strings.waveTypeOffline)).toBeInTheDocument();
    // week count for w1
    expect(screen.getByText(`2 ${strings.waveWeeksLabel}`)).toBeInTheDocument();
  });
});
