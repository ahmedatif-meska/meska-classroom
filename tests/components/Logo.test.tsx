import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Logo from "@/components/Logo";

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
  // eslint-disable-next-line @next/next/no-img-element
  }) => <img src={src} alt={alt} width={width} height={height} />,
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

describe("<Logo>", () => {
  it("renders a link to homeHref", () => {
    render(<Logo homeHref="/student" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/student");
  });

  it("renders exactly one link", () => {
    render(<Logo homeHref="/student" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("has a non-empty aria-label", () => {
    render(<Logo homeHref="/student" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).not.toBe("");
    expect(link.getAttribute("aria-label")).not.toBeNull();
  });

  it("renders an image with meaningful alt text", () => {
    render(<Logo homeHref="/student" />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("alt")).not.toBe("");
  });

  it("link is keyboard-focusable (no tabIndex=-1)", () => {
    render(<Logo homeHref="/student" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("tabIndex")).not.toBe("-1");
  });
});
