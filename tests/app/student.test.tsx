import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// StudentLoginForm is a client island that imports the server action — stub it.
vi.mock("@/app/student/actions", () => ({ signInStudent: vi.fn() }));

import StudentHome from "@/app/student/page";

describe("Student sign-in page", () => {
  it("renders the Welcome heading", () => {
    render(<StudentHome />);
    expect(
      screen.getByRole("heading", { name: /welcome/i })
    ).toBeInTheDocument();
  });

  it("renders Email and Password fields (email + password login)", () => {
    render(<StudentHome />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("does not render Full Name, Student ID, or Session Room fields", () => {
    render(<StudentHome />);
    expect(screen.queryByLabelText(/full name/i)).toBeNull();
    expect(screen.queryByLabelText(/student id/i)).toBeNull();
    expect(screen.queryByLabelText(/session room/i)).toBeNull();
  });

  it("renders the Sign In button and the login-ID note", () => {
    render(<StudentHome />);
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/login id is your email/i)).toBeInTheDocument();
  });

  it("renders the Meska logo", () => {
    render(<StudentHome />);
    expect(screen.getByRole("img", { name: /meska/i })).toBeInTheDocument();
  });

  it("contains no link to the admin panel (panel isolation)", () => {
    render(<StudentHome />);
    const adminLinks = screen
      .queryAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("/admin"));
    expect(adminLinks).toHaveLength(0);
  });
});
