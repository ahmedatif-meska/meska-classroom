import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

import DashboardShell, { type NavItem } from "@/components/DashboardShell";

const weeksGroup: NavItem = {
  label: "Weeks",
  href: "#weeks",
  children: [
    { label: "Week 1", href: "/student/dashboard/weeks/w1" },
    { label: "Week 2", href: "/student/dashboard/weeks/w2" },
  ],
  childrenEmptyLabel: "No weeks yet",
};

const homeItem: NavItem = { label: "Home", href: "/student/dashboard" };

describe("DashboardShell — collapsible nav group", () => {
  it("renders a collapsed disclosure with aria-expanded/controls and hides children", () => {
    render(
      <DashboardShell
        panelName="Student"
        navItems={[homeItem, weeksGroup]}
        activeHref="/student/dashboard"
      >
        <div />
      </DashboardShell>
    );
    const toggle = screen.getByRole("button", { name: /weeks/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls");
    // Collapsed → children not in the document yet.
    expect(
      screen.queryByRole("link", { name: "Week 1" })
    ).not.toBeInTheDocument();
  });

  it("expands to reveal child links when toggled (keyboard-activatable button)", () => {
    render(
      <DashboardShell
        panelName="Student"
        navItems={[homeItem, weeksGroup]}
        activeHref="/student/dashboard"
      >
        <div />
      </DashboardShell>
    );
    const toggle = screen.getByRole("button", { name: /weeks/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Week 1" })
    ).toHaveAttribute("href", "/student/dashboard/weeks/w1");
    expect(screen.getByRole("link", { name: "Week 2" })).toBeInTheDocument();
  });

  it("auto-expands when one of its children is the active route", () => {
    render(
      <DashboardShell
        panelName="Student"
        navItems={[homeItem, weeksGroup]}
        activeHref="/student/dashboard/weeks/w2"
      >
        <div />
      </DashboardShell>
    );
    expect(screen.getByRole("button", { name: /weeks/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    const active = screen.getByRole("link", { name: "Week 2" });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("shows the empty-state label for a group with no children", () => {
    render(
      <DashboardShell
        panelName="Student"
        navItems={[homeItem, { ...weeksGroup, children: [] }]}
        activeHref="/student/dashboard"
      >
        <div />
      </DashboardShell>
    );
    fireEvent.click(screen.getByRole("button", { name: /weeks/i }));
    expect(screen.getByText("No weeks yet")).toBeInTheDocument();
  });

  it("renders a flat nav (no children) unchanged as links", () => {
    const flat: NavItem[] = [
      { label: "Dashboard", href: "/admin/dashboard" },
      { label: "Members", href: "/admin/members" },
    ];
    render(
      <DashboardShell
        panelName="Admin"
        navItems={flat}
        activeHref="/admin/dashboard"
      >
        <div />
      </DashboardShell>
    );
    // No disclosure buttons for a flat nav; entries are plain links.
    expect(
      screen.queryByRole("button", { name: /dashboard/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Dashboard" })
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Members" })).toBeInTheDocument();
  });
});
