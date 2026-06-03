import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentDashboard from "@/app/student/dashboard/page";

describe("Student dashboard page", () => {
  it("renders the Student panel label in the sidebar", () => {
    render(<StudentDashboard />);
    // Appears in both the mobile top bar and the sidebar header.
    expect(screen.getAllByText("Student").length).toBeGreaterThan(0);
  });

  it("renders the Dashboard nav item", () => {
    render(<StudentDashboard />);
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it("renders the Dashboard heading", () => {
    render(<StudentDashboard />);
    expect(
      screen.getByRole("heading", { name: /dashboard/i })
    ).toBeInTheDocument();
  });

  it("renders the student subtitle", () => {
    render(<StudentDashboard />);
    expect(screen.getByText(/student workspace/i)).toBeInTheDocument();
  });

  it("contains no link to the admin panel (panel isolation)", () => {
    render(<StudentDashboard />);
    const links = screen.queryAllByRole("link");
    const adminLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/admin")
    );
    expect(adminLinks).toHaveLength(0);
  });
});
