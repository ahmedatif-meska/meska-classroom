import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

const upload = vi.hoisted(() =>
  vi.fn(async () => ({ data: { path: "p" }, error: null }))
);
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ upload }) } }),
}));

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
  removeAssignment: actions.removeAssignment,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock("@/components/RichTextEditor", () => ({
  default: () => <div data-testid="rte" />,
}));

import WaveBuilder from "@/components/WaveBuilder";

beforeEach(() => vi.clearAllMocks());

const pdf = (n: string) => new File(["x"], n, { type: "application/pdf" });
const saveButton = () =>
  screen.getByRole("button", { name: strings.waveFormSubmitLabel });
const addWeekBtn = () =>
  screen.getByRole("button", { name: strings.weekAddLabel });
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
          url: "http://x/a1",
          instructions_html: null,
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
    expect(addWeekBtn()).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
    expect(screen.getByText(strings.weeksEmptyNote)).toBeInTheDocument();
  });

  it("a new week exposes bulk material + assignment uploaders", () => {
    render(<WaveBuilder />);
    fireEvent.click(addWeekBtn());
    expect(
      screen.getByPlaceholderText(strings.weekTitlePlaceholder)
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(strings.materialUploadLabel))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(strings.assignmentAddLabel))
    ).toBeInTheDocument();
    // Two multi-file inputs: materials + assignments.
    expect(document.querySelectorAll('input[type="file"][multiple]')).toHaveLength(
      2
    );
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

  it("persists the draft in order: wave → week → material + assignment files", async () => {
    render(<WaveBuilder />);
    setBasics();
    fireEvent.click(addWeekBtn());
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fireEvent.change(fileInputs[0], { target: { files: [pdf("slides.pdf")] } }); // materials
    fireEvent.change(fileInputs[1], { target: { files: [pdf("hw.pdf")] } }); // assignments

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
    // The file bytes were uploaded browser→Storage; the actions get the path.
    expect(upload).toHaveBeenCalledTimes(2);
    expect(actions.addMaterial.mock.calls[0][1].get("file_path")).toMatch(
      /^w1\/wk1\/[0-9a-f-]{36}\.pdf$/
    );
    expect(actions.addAssignment.mock.calls[0][1].get("file_path")).toMatch(
      /^w1\/wk1\/assignment-[0-9a-f-]{36}\.pdf$/
    );
    expect(actions.addAssignment.mock.calls[0][1].get("title")).toBe("hw.pdf");
  });
});

describe("WaveBuilder — edit (seeded)", () => {
  it("pre-fills the saved data and shows existing material/assignment files", () => {
    render(<WaveBuilder existing={EXISTING} />);
    expect(screen.getByLabelText(/wave name/i)).toHaveValue("July");
    expect(screen.getByDisplayValue("Week 1")).toBeInTheDocument();
    expect(screen.getByText("Slides")).toBeInTheDocument();
    expect(screen.getByText("Homework")).toBeInTheDocument();
  });

  it("Save updates the existing wave + week (no create/add for untouched files)", async () => {
    render(<WaveBuilder existing={EXISTING} />);
    fireEvent.click(saveButton());
    await waitFor(() => expect(actions.updateWave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(actions.updateWeek).toHaveBeenCalledTimes(1));
    expect(actions.createWave).not.toHaveBeenCalled();
    expect(actions.addWeek).not.toHaveBeenCalled();
    expect(actions.addMaterial).not.toHaveBeenCalled();
    expect(actions.addAssignment).not.toHaveBeenCalled();
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

  it("deleting an existing assignment removes it via the server immediately", async () => {
    render(<WaveBuilder existing={EXISTING} />);
    fireEvent.click(
      screen.getByRole("button", { name: strings.assignmentRemoveLabel })
    );
    await waitFor(() =>
      expect(actions.removeAssignment).toHaveBeenCalledTimes(1)
    );
    expect(actions.removeAssignment.mock.calls[0][1].get("id")).toBe("a1");
    await waitFor(() =>
      expect(screen.queryByText("Homework")).not.toBeInTheDocument()
    );
  });
});
