import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminHome from "@/app/admin/page";

describe("Admin portal page", () => {
  it("renders the Admin Portal heading", () => {
    render(<AdminHome />);
    expect(
      screen.getByRole("heading", { name: /admin portal/i })
    ).toBeInTheDocument();
  });

  it("renders Email Address and Password fields", () => {
    render(<AdminHome />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("renders the Sign In button", () => {
    render(<AdminHome />);
    expect(
      screen.getByRole("button", { name: /^sign in$/i })
    ).toBeInTheDocument();
  });

  it("renders the protected-access note", () => {
    render(<AdminHome />);
    expect(
      screen.getByText(/protected admin access only/i)
    ).toBeInTheDocument();
  });

  it("contains no link to the student panel (panel isolation)", () => {
    render(<AdminHome />);
    const links = screen.queryAllByRole("link");
    const studentLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/student")
    );
    expect(studentLinks).toHaveLength(0);
  });
});
