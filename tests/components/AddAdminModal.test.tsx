import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const createAdmin = vi.fn();
vi.mock("@/app/admin/actions", () => ({
  createAdmin: (prev: unknown, fd: FormData) => createAdmin(prev, fd),
}));

import AddAdminModal from "@/components/AddAdminModal";

beforeEach(() => {
  vi.clearAllMocks();
  createAdmin.mockResolvedValue({});
});

async function open() {
  const user = userEvent.setup();
  render(<AddAdminModal />);
  await user.click(screen.getByRole("button", { name: strings.adminMgmtAddLabel }));
  return user;
}

describe("AddAdminModal (US2.1)", () => {
  it("opens the Create New Admin dialog with required fields and an Admin-only role", async () => {
    await open();
    expect(
      screen.getByRole("heading", { name: strings.createAdminTitle })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();

    const roleOptions = screen.getAllByRole("option");
    expect(roleOptions).toHaveLength(1);
    expect(roleOptions[0]).toHaveTextContent(strings.adminMgmtRoleAdmin);
  });

  it("closes without creating when Cancel is clicked", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: strings.cancelLabel }));
    expect(
      screen.queryByRole("heading", { name: strings.createAdminTitle })
    ).not.toBeInTheDocument();
    expect(createAdmin).not.toHaveBeenCalled();
  });

  it("surfaces a duplicate-email error returned by the action", async () => {
    createAdmin.mockResolvedValue({ error: strings.adminMgmtEmailInUse });
    const user = await open();
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email/i), "dupe@x.com");
    await user.click(
      screen.getByRole("button", { name: strings.createAdminSubmitLabel })
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.adminMgmtEmailInUse);
  });

  it("surfaces the invite-not-sent warning when delivery fails (FR-021)", async () => {
    createAdmin.mockResolvedValue({ created: true, inviteFailed: true });
    const user = await open();
    await user.type(screen.getByLabelText(/first name/i), "John");
    await user.type(screen.getByLabelText(/last name/i), "Doe");
    await user.type(screen.getByLabelText(/email/i), "j@x.com");
    await user.click(
      screen.getByRole("button", { name: strings.createAdminSubmitLabel })
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.adminMgmtInviteNotSent);
  });
});
