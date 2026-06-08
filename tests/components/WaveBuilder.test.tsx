import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

const actions = vi.hoisted(() => ({
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
  updateWave: vi.fn(async () => ({ saved: true })),
  addWeek: vi.fn(async () => ({ saved: true, id: "wk1" })),
  updateWeek: vi.fn(async () => ({ saved: true })),
  removeWeek: vi.fn(async () => ({ saved: true })),
  addMaterial: vi.fn(async () => ({ saved: true })),
  removeMaterial: vi.fn(async () => ({ saved: true })),
  addAssignment: vi.fn(async () => ({ saved: true })),
  updateAssignment: vi.fn(async () => ({ saved: true })),
  removeAssignment: vi.fn(async () => ({ saved: true })),
  push: vi.fn(),
}));

vi.mock("@/app/admin/waves/actions", () => ({
  createWave: actions.createWave,
  updateWave: actions.updateWave,
  addWeek: actions.addWeek,
  updateWeek: actions.updateWeek,
  removeWeek: actions.removeWeek,
  addMaterial: actions.addMaterial,
  removeMaterial: actions.removeMaterial,
  addAssignment: actions.addAssignment,
  updateAssignment: actions.updateAssignment,
  removeAssignment: actions.removeAssignment,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
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

const EXISTING = {
  wave: {
    id: "w1",
    name: "July",
    description_html: "<p>hi</p>",
    type: "online" as const,
    created_at: "",
  },
  weeks: [
    {
      id: "wk1",
      title: "Week 1",
      position: 1,
      description_html: "intro",
      materials: [{ id: "m1", title: "Slides", url: "http://x/m1" }],
      assignments: [
        {
          id: "a1",
          title: "Homework",
          instructions_html: "do it",
          due_at: null,
          submissions: [],
        },
      ],
    },
  ],
};

describe("WaveBuilder — create", () => {
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
    expect(actions.createWave).not.toHaveBeenCalled();
  });

  it("persists the whole draft in order: wave → week → material + assignment", async () => {
    render(<WaveBuilder />);
    setBasics();
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.weekAddLabel}` })
    );
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.materialAddLabel}` })
    );
    fireEvent.change(screen.getByPlaceholderText(strings.materialTitleLabel), {
      target: { value: "Slides" },
    });
    const file = new File(["x"], "slides.pdf", { type: "application/pdf" });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: `+ ${strings.assignmentAddLabel}` })
    );
    const titles = screen.getAllByPlaceholderText(strings.assignmentTitleLabel);
    fireEvent.change(titles[titles.length - 1], {
      target: { value: "Homework 1" },
    });

    fireEvent.click(saveButton());

    await waitFor(() => expect(actions.createWave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.addWeek).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.addMaterial).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.addAssignment).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(actions.push).toHaveBeenCalledWith("/admin/waves")
    );
    expect(actions.addMaterial.mock.calls[0][1].get("week_id")).toBe("wk1");
    expect(actions.addAssignment.mock.calls[0][1].get("week_id")).toBe("wk1");
  });
});

describe("WaveBuilder — edit (seeded)", () => {
  it("pre-fills the saved data and shows existing material/assignment", () => {
    render(<WaveBuilder existing={EXISTING} />);
    expect(screen.getByLabelText(/wave name/i)).toHaveValue("July");
    expect(
      screen.getByDisplayValue("Week 1") // editable week title
    ).toBeInTheDocument();
    expect(screen.getByText("Slides")).toBeInTheDocument(); // material indicator
    expect(screen.getByDisplayValue("Homework")).toBeInTheDocument(); // assignment title
  });

  it("Save updates the existing wave/week/assignment (no create/add)", async () => {
    render(<WaveBuilder existing={EXISTING} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(actions.updateWave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.updateWeek).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(actions.updateAssignment).toHaveBeenCalledTimes(1)
    );
    expect(actions.createWave).not.toHaveBeenCalled();
    expect(actions.addWeek).not.toHaveBeenCalled();
    expect(actions.addMaterial).not.toHaveBeenCalled();
  });

  it("deleting an existing material removes it via the server immediately", async () => {
    render(<WaveBuilder existing={EXISTING} />);
    fireEvent.click(
      screen.getByRole("button", { name: strings.materialRemoveLabel })
    );
    await waitFor(() => expect(actions.removeMaterial).toHaveBeenCalledTimes(1));
    expect(actions.removeMaterial.mock.calls[0][1].get("id")).toBe("m1");
    await waitFor(() =>
      expect(screen.queryByText("Slides")).not.toBeInTheDocument()
    );
  });
});
