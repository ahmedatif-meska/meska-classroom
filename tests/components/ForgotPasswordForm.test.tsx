import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const requestPasswordReset = vi.fn<
  (prev: unknown, fd: FormData) => Promise<{ sent: boolean }>
>(async () => ({ sent: true }));
vi.mock("@/app/admin/actions", () => ({
  requestPasswordReset: (prev: unknown, fd: FormData) =>
    requestPasswordReset(prev, fd),
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

import ForgotPasswordForm from "@/components/ForgotPasswordForm";

describe("ForgotPasswordForm (US1.1)", () => {
  it("marks the email field as required", () => {
    render(<ForgotPasswordForm />);
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
  });

  it("renders the send button and a back-to-sign-in link", () => {
    render(<ForgotPasswordForm />);
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to sign in/i })
    ).toHaveAttribute("href", "/admin");
  });

  it("shows the neutral confirmation after a successful request (SC-002)", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/email address/i), "admin@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.resetLinkSent);
  });
});
