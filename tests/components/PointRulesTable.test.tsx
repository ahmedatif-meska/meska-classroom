import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const updatePointRule = vi.fn<
  (prev: unknown, fd: FormData) => Promise<{ error?: string; saved?: boolean }>
>(async () => ({ saved: true }));
vi.mock("@/app/admin/points/actions", () => ({
  updatePointRule: (prev: unknown, fd: FormData) => updatePointRule(prev, fd),
}));

import PointRulesTable from "@/components/PointRulesTable";

const rules = [
  { action: "attendance" as const, points: 10 },
  { action: "assignment" as const, points: 20 },
  { action: "feedback" as const, points: 30 },
];

beforeEach(() => {
  vi.clearAllMocks();
  updatePointRule.mockResolvedValue({ saved: true });
});

describe("PointRulesTable (US4)", () => {
  it("renders the three labelled actions with their current values", () => {
    render(<PointRulesTable rules={rules} />);
    expect(
      screen.getByLabelText(strings.pointsActionAttendance)
    ).toHaveValue(10);
    expect(
      screen.getByLabelText(strings.pointsActionAssignment)
    ).toHaveValue(20);
    expect(screen.getByLabelText(strings.pointsActionFeedback)).toHaveValue(30);
  });

  it("submits the row's action and edited value on Save", async () => {
    const user = userEvent.setup();
    render(<PointRulesTable rules={rules} />);

    const input = screen.getByLabelText(strings.pointsActionAssignment);
    await user.clear(input);
    await user.type(input, "25");
    await user.click(
      screen.getAllByRole("button", { name: strings.pointsSaveLabel })[1]
    );

    expect(updatePointRule).toHaveBeenCalledOnce();
    const fd = updatePointRule.mock.calls[0][1];
    expect(fd.get("action")).toBe("assignment");
    expect(fd.get("points")).toBe("25");
  });

  it("shows the saved confirmation after a successful save", async () => {
    const user = userEvent.setup();
    render(<PointRulesTable rules={rules} />);
    await user.click(
      screen.getAllByRole("button", { name: strings.pointsSaveLabel })[0]
    );
    expect(await screen.findByText(strings.pointsSavedNote)).toBeInTheDocument();
  });

  it("renders a rejection as an alert (prior persisted value unchanged, FR-021)", async () => {
    updatePointRule.mockResolvedValueOnce({ error: strings.pointsInvalid });
    const user = userEvent.setup();
    render(<PointRulesTable rules={rules} />);

    // Blank passes the browser's number-input constraints and is rejected
    // server-side (negatives/fractions are additionally blocked client-side
    // by min/step, and covered by the action tests).
    await user.clear(screen.getByLabelText(strings.pointsActionFeedback));
    await user.click(
      screen.getAllByRole("button", { name: strings.pointsSaveLabel })[2]
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.pointsInvalid);
  });
});
