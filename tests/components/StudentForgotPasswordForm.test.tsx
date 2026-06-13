import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const requestStudentPasswordReset = vi.fn<
  (prev: unknown, fd: FormData) => Promise<{ sent?: boolean; error?: string }>
>(async () => ({ sent: true }));
vi.mock("@/app/student/actions", () => ({
  requestStudentPasswordReset: (prev: unknown, fd: FormData) =>
    requestStudentPasswordReset(prev, fd),
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

import StudentForgotPasswordForm from "@/components/StudentForgotPasswordForm";

describe("StudentForgotPasswordForm (US1)", () => {
  it("marks the email field as required", () => {
    render(<StudentForgotPasswordForm />);
    expect(screen.getByLabelText(/email address/i)).toBeRequired();
  });

  it("renders the send button and a back-to-sign-in link to /student", () => {
    render(<StudentForgotPasswordForm />);
    expect(
      screen.getByRole("button", { name: strings.studentForgotSubmitLabel })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.backToSignInLabel })
    ).toHaveAttribute("href", "/student");
  });

  it("shows the neutral confirmation after a request (SC-002)", async () => {
    const user = userEvent.setup();
    render(<StudentForgotPasswordForm />);
    await user.type(
      screen.getByLabelText(/email address/i),
      "member@example.com"
    );
    await user.click(
      screen.getByRole("button", { name: strings.studentForgotSubmitLabel })
    );

    expect(
      await screen.findByText(strings.studentForgotSentTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByText(strings.studentForgotSentNote)
    ).toBeInTheDocument();
  });

  it("renders a field error with role=alert", async () => {
    requestStudentPasswordReset.mockResolvedValueOnce({
      error: strings.forgotEmailRequired,
    });
    const user = userEvent.setup();
    render(<StudentForgotPasswordForm />);
    await user.type(screen.getByLabelText(/email address/i), "x@example.com");
    await user.click(
      screen.getByRole("button", { name: strings.studentForgotSubmitLabel })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.forgotEmailRequired);
  });
});
