import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import strings from "@/lib/strings";
import WeekFeedback from "@/components/WeekFeedback";

describe("WeekFeedback", () => {
  it("renders session and instructor star ratings plus a comment box", () => {
    render(<WeekFeedback />);
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
    render(<WeekFeedback />);
    const submit = screen.getByRole("button", {
      name: strings.studentFeedbackSubmitLabel,
    });
    expect(submit).toBeDisabled();

    // Pick 4 stars for the session rating (each star is a radio).
    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    const stars = within(sessionGroup).getAllByRole("radio");
    fireEvent.click(stars[3]);
    expect(submit).toBeEnabled();
  });

  it("shows a thank-you message after submitting", () => {
    render(<WeekFeedback />);
    const sessionGroup = screen.getByRole("radiogroup", {
      name: strings.studentFeedbackSessionLabel,
    });
    fireEvent.click(within(sessionGroup).getAllByRole("radio")[4]);
    fireEvent.click(
      screen.getByRole("button", { name: strings.studentFeedbackSubmitLabel })
    );
    expect(screen.getByText(strings.studentFeedbackThanks)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: strings.studentFeedbackSubmitLabel,
      })
    ).not.toBeInTheDocument();
  });
});
