import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboard from "@/app/admin/dashboard/page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { email: "admin@example.com" } },
      })),
    },
  })),
}));

describe("Admin dashboard page", () => {
  it("renders the Admin panel label in the sidebar", async () => {
    render(await AdminDashboard());
    // Appears in both the mobile top bar and the sidebar header.
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
  });

  it("renders the Dashboard nav item", async () => {
    render(await AdminDashboard());
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it("renders the Dashboard heading", async () => {
    render(await AdminDashboard());
    expect(
      screen.getByRole("heading", { name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it("renders the admin subtitle", async () => {
    render(await AdminDashboard());
    expect(screen.getByText(/admin workspace/i)).toBeInTheDocument();
  });

  it("shows the signed-in admin email and a sign-out button in the sidebar footer", async () => {
    render(await AdminDashboard());
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i })
    ).toBeInTheDocument();
  });

  it("contains no link to the student panel (panel isolation)", async () => {
    render(await AdminDashboard());
    const links = screen.queryAllByRole("link");
    const studentLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/student")
    );
    expect(studentLinks).toHaveLength(0);
  });
});
