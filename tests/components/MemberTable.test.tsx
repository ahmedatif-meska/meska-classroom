import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const reassignMembers = vi.fn();
vi.mock("@/app/admin/members/actions", () => ({
  reassignMembers: (prev: unknown, fd: FormData) => reassignMembers(prev, fd),
  resendMemberInvite: vi.fn(),
  removeMember: vi.fn(),
}));

import MemberTable, { type MemberRow } from "@/components/MemberTable";

const waves = [
  { id: "w1", name: "Offline" },
  { id: "w2", name: "Online" },
];

const assigned: MemberRow = {
  id: "m1",
  full_name: "Mona Ali",
  whatsapp: "+201111111111",
  email: "mona@example.com",
  status: "active",
  wave_name: "Online",
};
const unassignedA: MemberRow = {
  id: "m2",
  full_name: "Sara Adel",
  whatsapp: "+201222222222",
  email: "sara@example.com",
  status: "pending",
  wave_name: null,
};
const unassignedB: MemberRow = {
  id: "m3",
  full_name: "Omar Nour",
  whatsapp: "+201333333333",
  email: "omar@example.com",
  status: "active",
  wave_name: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  reassignMembers.mockResolvedValue({ reassignedCount: 1, failedCount: 0 });
});

describe("MemberTable — reassign selection", () => {
  it("shows an Unassigned chip for members without a wave", () => {
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    expect(screen.getAllByText(strings.membersWaveUnassigned)).toHaveLength(2);
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("offers checkboxes only for unassigned members, plus a select-all", () => {
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    // 1 header select-all + 2 unassigned rows; the assigned row has none.
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(
      screen.getByRole("checkbox", { name: strings.reassignSelectAllAria })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: `${strings.reassignSelectOneAria} Sara Adel`,
      })
    ).toBeInTheDocument();
  });

  it("renders no selection UI at all when every member is assigned", () => {
    render(<MemberTable members={[assigned]} waves={waves} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: strings.reassignToolbarLabel })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: strings.reassignRowLabel })
    ).not.toBeInTheDocument();
  });

  it("select-all selects every unassigned member and updates the count", async () => {
    const user = userEvent.setup();
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `0 ${strings.reassignSelectedLabel}`
    );
    await user.click(
      screen.getByRole("checkbox", { name: strings.reassignSelectAllAria })
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `2 ${strings.reassignSelectedLabel}`
    );
    expect(
      screen.getByRole("checkbox", {
        name: `${strings.reassignSelectOneAria} Omar Nour`,
      })
    ).toBeChecked();
  });

  it("the toolbar button is disabled with nothing selected and opens the modal with the selection", async () => {
    const user = userEvent.setup();
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    const toolbar = screen.getByRole("button", {
      name: strings.reassignToolbarLabel,
    });
    expect(toolbar).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", { name: strings.reassignSelectAllAria })
    );
    expect(toolbar).toBeEnabled();
    await user.click(toolbar);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: strings.reassignTitle })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(new RegExp(`2 ${strings.reassignSelectedLabel}`))
    ).toBeInTheDocument();
    const hidden = dialog.querySelectorAll('input[name="member_ids"]');
    expect(Array.from(hidden).map((i) => (i as HTMLInputElement).value)).toEqual(
      ["m2", "m3"]
    );
  });

  it("the per-row Reassign button opens the modal for just that member", async () => {
    const user = userEvent.setup();
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    // Only the two unassigned rows offer Reassign.
    const rowButtons = screen.getAllByRole("button", {
      name: strings.reassignRowLabel,
    });
    expect(rowButtons).toHaveLength(2);

    await user.click(rowButtons[0]);
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(new RegExp(`1 ${strings.reassignSelectedLabel}`))
    ).toBeInTheDocument();
    const hidden = dialog.querySelectorAll('input[name="member_ids"]');
    expect(Array.from(hidden).map((i) => (i as HTMLInputElement).value)).toEqual(
      ["m2"]
    );
  });

  it("submits the chosen wave + member ids to reassignMembers, then Done clears the selection", async () => {
    const user = userEvent.setup();
    render(
      <MemberTable members={[assigned, unassignedA, unassignedB]} waves={waves} />
    );
    await user.click(
      screen.getByRole("checkbox", { name: strings.reassignSelectAllAria })
    );
    await user.click(
      screen.getByRole("button", { name: strings.reassignToolbarLabel })
    );

    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(strings.memberWaveLabel, "i")),
      "w1"
    );
    reassignMembers.mockResolvedValue({ reassignedCount: 2, failedCount: 0 });
    await user.click(
      within(dialog).getByRole("button", { name: strings.reassignSubmitLabel })
    );

    expect(
      await within(dialog).findByText(
        new RegExp(`2 ${strings.reassignSuccessLabel}`)
      )
    ).toBeInTheDocument();
    const fd = reassignMembers.mock.calls[0][1] as FormData;
    expect(fd.getAll("member_ids")).toEqual(["m2", "m3"]);
    expect(fd.get("wave_id")).toBe("w1");

    await user.click(
      within(dialog).getByRole("button", { name: strings.bulkDoneLabel })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `0 ${strings.reassignSelectedLabel}`
    );
  });

  it("keeps the modal open and shows the error returned by the action", async () => {
    reassignMembers.mockResolvedValue({ error: strings.reassignFailed });
    const user = userEvent.setup();
    render(<MemberTable members={[unassignedA]} waves={waves} />);
    await user.click(
      screen.getByRole("button", { name: strings.reassignRowLabel })
    );
    const dialog = screen.getByRole("dialog");
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(strings.memberWaveLabel, "i")),
      "w2"
    );
    await user.click(
      within(dialog).getByRole("button", { name: strings.reassignSubmitLabel })
    );
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(strings.reassignFailed);
  });
});
