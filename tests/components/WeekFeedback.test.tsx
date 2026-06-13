import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const submitFeedback = vi.fn<
  (
    prev: unknown,
    fd: FormData
  ) => Promise<{ error?: string; saved?: boolean; awardedPoints?: number }>
>(async () => ({ saved: true, awardedPoints: 30 }));
vi.mock("@/app/student/actions", () => ({
  submitFeedback: (prev: unknown, fd: FormData) => submitFeedback(prev, fd),
}));

import WeekFeedback from "@/components/WeekFeedback";

beforeEach(() => {
  vi.clearAllMocks();
  submitFeedback.mockResolvedValue({ saved: true, awardedPoints: 30 });
});

describe("WeekFeedback (US5 — persisted)", () => {
  it("renders session and instructor star ratings plus a comment box", () => {
    render(<WeekFeedback weekId="wk-1" />);
    expect(
      screen.getByRole("radiogroup", {
        name: strings.studentFeedbackSessionLabel,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", {
        name: strings.studentFeedbackInstructorLabel,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(strings.studentFeedbackCommentPlaceholder)
    ).toBeInTheDocument();
  });

  it("keeps Submit disabled until a rating or comment is provided", () => {
    render(<WeekFeedback weekId="wk-1" />);
    const submit = screen.getByRole("button", {
      name: strings.studentFeedbackSubmitLabel,
    });
    expect(submit).toBeDisabled();

    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    fireEvent.click(within(sessionGroup).getAllByRole("radio")[3]);
    expect(submit).toBeEnabled();
  });

  it("submits the week id, ratings, and comment through the action", async () => {
    const user = userEvent.setup();
    render(<WeekFeedback weekId="wk-1" />);

    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    await user.click(within(sessionGroup).getAllByRole("radio")[4]); // 5 stars
    await user.type(
      screen.getByPlaceholderText(strings.studentFeedbackCommentPlaceholder),
      "Great week!"
    );
    await user.click(
      screen.getByRole("button", { name: strings.studentFeedbackSubmitLabel })
    );

    expect(submitFeedback).toHaveBeenCalledOnce();
    const fd = submitFeedback.mock.calls[0][1];
    expect(fd.get("week_id")).toBe("wk-1");
    expect(fd.get("session_rating")).toBe("5");
    expect(fd.get("comment")).toBe("Great week!");
  });

  it("shows the thank-you popup naming the awarded points (FR-025)", async () => {
    const user = userEvent.setup();
    render(<WeekFeedback weekId="wk-1" />);
    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    await user.click(within(sessionGroup).getAllByRole("radio")[4]);
    await user.click(
      screen.getByRole("button", { name: strings.studentFeedbackSubmitLabel })
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(strings.studentFeedbackThanksTitle)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `${strings.studentFeedbackAwardedPrefix} 30 ${strings.studentRewardsPointsUnit}`
      )
    ).toBeInTheDocument();
  });

  it("dismisses the popup on Escape without resubmitting", async () => {
    const user = userEvent.setup();
    render(<WeekFeedback weekId="wk-1" />);
    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    await user.click(within(sessionGroup).getAllByRole("radio")[4]);
    await user.click(
      screen.getByRole("button", { name: strings.studentFeedbackSubmitLabel })
    );
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitFeedback).toHaveBeenCalledOnce();
  });

  it("renders an action error as an alert", async () => {
    submitFeedback.mockResolvedValueOnce({
      error: strings.studentFeedbackFailed,
    });
    const user = userEvent.setup();
    render(<WeekFeedback weekId="wk-1" />);
    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    await user.click(within(sessionGroup).getAllByRole("radio")[0]);
    await user.click(
      screen.getByRole("button", { name: strings.studentFeedbackSubmitLabel })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.studentFeedbackFailed);
  });
});
