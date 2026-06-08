import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

const { createWave, addWeek, addMaterial, addAssignment, push } = vi.hoisted(
  () => ({
    createWave: vi.fn(async () => ({
      saved: true,
      wave: {
        id: "w1",
        name: "July",
        description_html: null,
        type: "online",
        created_at: "",
      },
    })),
    addWeek: vi.fn(async () => ({ saved: true, id: "wk1" })),
    addMaterial: vi.fn(async () => ({ saved: true })),
    addAssignment: vi.fn(async () => ({ saved: true })),
    push: vi.fn(),
  })
);

vi.mock("@/app/admin/waves/actions", () => ({
  createWave,
  addWeek,
  addMaterial,
  addAssignment,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/RichTextEditor", () => ({
  default: () => <div data-testid="rte" />,
}));

import WaveBuilder from "@/components/WaveBuilder";

beforeEach(() => vi.clearAllMocks());

const saveButton = () =>
  screen.getByRole("button", { name: strings.waveFormSubmitLabel });
const setBasics = () => {
  fireEvent.change(screen.getByLabelText(/wave name/i), {
    target: { value: "July" },
  });
  fireEvent.click(screen.getByRole("button", { name: strings.waveTypeOnline }));
};

describe("WaveBuilder (one-page draft, single Save)", () => {
  it("renders the basics, an Add-week button and a Save button", () => {
    render(<WaveBuilder />);
    expect(screen.getByLabelText(/wave name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `+ ${strings.weekAddLabel}` })
    ).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
    expect(screen.getByText(strings.weeksEmptyNote)).toBeInTheDocument();
  });

  it("adds a week with material and assignment controls when Add week is clicked", () => {
    render(<WaveBuilder />);
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.weekAddLabel}` })
    );
    expect(
      screen.getByPlaceholderText(strings.weekTitlePlaceholder)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `+ ${strings.materialAddLabel}` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `+ ${strings.assignmentAddLabel}` })
    ).toBeInTheDocument();
  });

  it("blocks Save with a missing type and writes nothing", async () => {
    render(<WaveBuilder />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(saveButton());
    expect(await screen.findByText(strings.wavesTypeRequired)).toBeInTheDocument();
    expect(createWave).not.toHaveBeenCalled();
  });

  it("saves an empty wave (no weeks) and navigates to the list", async () => {
    render(<WaveBuilder />);
    setBasics();
    fireEvent.click(saveButton());
    await waitFor(() => expect(createWave).toHaveBeenCalledTimes(1));
    expect(addWeek).not.toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/waves"));
  });

  it("persists the whole draft in order: wave → week → material + assignment", async () => {
    render(<WaveBuilder />);
    setBasics();
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.weekAddLabel}` })
    );

    // A material with a title + file.
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.materialAddLabel}` })
    );
    fireEvent.change(screen.getByPlaceholderText(strings.materialTitleLabel), {
      target: { value: "Slides" },
    });
    const file = new File(["x"], "slides.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // An assignment with a title. (Material + assignment share the "Title"
    // placeholder, so target the second title input — the assignment's.)
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.assignmentAddLabel}` })
    );
    const titleInputs = screen.getAllByPlaceholderText(
      strings.assignmentTitleLabel
    );
    fireEvent.change(titleInputs[titleInputs.length - 1], {
      target: { value: "Homework 1" },
    });

    fireEvent.click(saveButton());

    await waitFor(() => expect(createWave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addWeek).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addMaterial).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(addAssignment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/waves"));

    // The week id from addWeek is forwarded to the material + assignment writes.
    expect(addMaterial.mock.calls[0][1].get("week_id")).toBe("wk1");
    expect(addAssignment.mock.calls[0][1].get("week_id")).toBe("wk1");
  });
});
