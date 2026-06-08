import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const createMember = vi.fn();
const bulkCreateMembers = vi.fn();
vi.mock("@/app/admin/members/actions", () => ({
  createMember: (prev: unknown, fd: FormData) => createMember(prev, fd),
  bulkCreateMembers: (prev: unknown, fd: FormData) => bulkCreateMembers(prev, fd),
  resendMemberInvite: vi.fn(),
}));

const parseAndValidateMembersCsv = vi.fn();
vi.mock("@/lib/members/csv", () => ({
  parseAndValidateMembersCsv: (text: string) => parseAndValidateMembersCsv(text),
}));

import AddMembersModal from "@/components/AddMembersModal";

const waves = [
  { id: "w1", name: "Offline" },
  { id: "w2", name: "Online" },
];

beforeEach(() => {
  vi.clearAllMocks();
  createMember.mockResolvedValue({});
  bulkCreateMembers.mockResolvedValue({});
});

async function openChooser() {
  const user = userEvent.setup();
  render(<AddMembersModal waves={waves} />);
  await user.click(screen.getByRole("button", { name: strings.membersAddLabel }));
  return user;
}

describe("AddMembersModal (US2.1 / US5.1)", () => {
  it("opens a chooser offering Add by form and Bulk upload", async () => {
    await openChooser();
    expect(
      screen.getByRole("button", { name: new RegExp(strings.addMemberFormOption, "i") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: new RegExp(strings.bulkUploadOption, "i") })
    ).toBeInTheDocument();
  });

  it("shows the single-add form with required fields and the seeded waves", async () => {
    const user = await openChooser();
    await user.click(
      screen.getByRole("button", { name: new RegExp(strings.addMemberFormOption, "i") })
    );
    expect(screen.getByLabelText(/full name/i)).toBeRequired();
    expect(screen.getByLabelText(/whatsapp/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining(["Offline", "Online"])
    );
  });

  it("offers a Create wave link to the wave-creation page (US4.2)", async () => {
    const user = await openChooser();
    await user.click(
      screen.getByRole("button", { name: new RegExp(strings.addMemberFormOption, "i") })
    );
    const link = screen.getByRole("link", {
      name: new RegExp(strings.wavesAddLabel, "i"),
    });
    expect(link).toHaveAttribute("href", "/admin/waves/new?from=members&step=form");
  });

  it("closes without creating when Cancel is clicked", async () => {
    const user = await openChooser();
    await user.click(
      screen.getByRole("button", { name: new RegExp(strings.addMemberFormOption, "i") })
    );
    await user.click(screen.getByRole("button", { name: strings.cancelLabel }));
    expect(
      screen.queryByRole("heading", { name: strings.memberFormTitle })
    ).not.toBeInTheDocument();
    expect(createMember).not.toHaveBeenCalled();
  });

  it("rejects a bulk CSV with a blank cell client-side and does not advance to the wave step", async () => {
    parseAndValidateMembersCsv.mockReturnValue({
      ok: false,
      error: strings.bulkBlankCell,
      badRows: [3],
    });
    const user = await openChooser();
    await user.click(
      screen.getByRole("button", { name: new RegExp(strings.bulkUploadOption, "i") })
    );
    const file = new File(["Full Name,WhatsApp Number,Email\n,,\n"], "members.csv", {
      type: "text/csv",
    });
    await user.upload(screen.getByLabelText(strings.bulkFileLabel), file);
    await user.click(screen.getByRole("button", { name: strings.bulkValidateLabel }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.bulkBlankCell);
    expect(
      screen.queryByRole("button", { name: strings.bulkSubmitLabel })
    ).not.toBeInTheDocument();
  });
});
