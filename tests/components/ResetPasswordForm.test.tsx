import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const updateAdminPassword = vi.fn<
  (prev: unknown, fd: FormData) => Promise<{ error: string }>
>(async () => ({ error: strings.resetPasswordMismatch }));
vi.mock("@/app/admin/actions", () => ({
  updateAdminPassword: (prev: unknown, fd: FormData) =>
    updateAdminPassword(prev, fd),
}));

import ResetPasswordForm from "@/components/ResetPasswordForm";

describe("ResetPasswordForm (US2.1)", () => {
  it("marks both password fields as required", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByLabelText(/^new password$/i)).toBeRequired();
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeRequired();
  });

  it("renders the update button", () => {
    render(<ResetPasswordForm />);
    expect(
      screen.getByRole("button", { name: /update password/i })
    ).toBeInTheDocument();
  });

  it("announces a validation error in a role=alert region after a failed submit", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText(/^new password$/i), "longenough1");
    await user.type(
      screen.getByLabelText(/^confirm new password$/i),
      "longenough2"
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.resetPasswordMismatch);
  });
});
