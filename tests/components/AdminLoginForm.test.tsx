import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

// Mock the Server Action so the component renders without the Supabase/Next request stack.
const signInAdmin = vi.fn<(prev: unknown, fd: FormData) => Promise<{ error: string }>>(
  async () => ({ error: strings.adminAuthFailed })
);
vi.mock("@/app/admin/actions", () => ({
  signInAdmin: (prev: unknown, fd: FormData) => signInAdmin(prev, fd),
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

import AdminLoginForm from "@/components/AdminLoginForm";

describe("AdminLoginForm (US3.1 mandatory fields + error state)", () => {
  it("marks both email and password as required", () => {
    render(<AdminLoginForm />);
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
    expect(screen.getByLabelText(/^password$/i)).toBeRequired();
  });

  it("renders the sign-in button", () => {
    render(<AdminLoginForm />);
    expect(
      screen.getByRole("button", { name: /^sign in$/i })
    ).toBeInTheDocument();
  });

  it("announces the generic failure in a role=alert region after a failed submit", async () => {
    const user = userEvent.setup();
    render(<AdminLoginForm />);
    await user.type(screen.getByLabelText(/email address/i), "admin@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.adminAuthFailed);
  });
});
