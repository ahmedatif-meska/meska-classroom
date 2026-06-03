import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentHome from "@/app/student/page";

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

describe("Student join-session page", () => {
  it("renders the Welcome heading", () => {
    render(<StudentHome />);
    expect(
      screen.getByRole("heading", { name: /welcome/i })
    ).toBeInTheDocument();
  });

  it("renders Student ID and Password fields", () => {
    render(<StudentHome />);
    expect(screen.getByLabelText(/student id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("does not render Full Name or Session Room fields", () => {
    render(<StudentHome />);
    expect(screen.queryByLabelText(/full name/i)).toBeNull();
    expect(screen.queryByLabelText(/session room/i)).toBeNull();
  });

  it("renders the Join session button", () => {
    render(<StudentHome />);
    expect(
      screen.getByRole("button", { name: /join session/i })
    ).toBeInTheDocument();
  });

  it("renders the Meska logo", () => {
    render(<StudentHome />);
    expect(screen.getByAltText(/meska/i)).toBeInTheDocument();
  });

  it("contains no link to the admin panel (panel isolation)", () => {
    render(<StudentHome />);
    const links = screen.queryAllByRole("link");
    const adminLinks = links.filter((l) =>
      l.getAttribute("href")?.includes("/admin")
    );
    expect(adminLinks).toHaveLength(0);
  });
});
