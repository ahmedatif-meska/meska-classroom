import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";
import type { AdminWeek } from "@/lib/waves/content";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: vi.fn() }) },
  }),
}));

const actions = vi.hoisted(() => ({
  createWave: vi.fn(async () => ({ saved: true })),
  updateWave: vi.fn(async () => ({ saved: true })),
  addWeek: vi.fn(async () => ({ saved: true, id: "wk1" })),
  updateWeek: vi.fn(async () => ({ saved: true })),
  removeWeek: vi.fn(async () => ({ saved: true })),
  addMaterial: vi.fn(async () => ({ saved: true })),
  removeMaterial: vi.fn(async () => ({ saved: true })),
  addAssignment: vi.fn(async () => ({ saved: true })),
  removeAssignment: vi.fn(async () => ({ saved: true })),
  addVideo: vi.fn(async () => ({ saved: true })),
  updateVideo: vi.fn(async () => ({ saved: true })),
  reorderVideo: vi.fn(async () => ({ saved: true })),
  removeVideo: vi.fn(async () => ({ saved: true })),
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
  addVideo: actions.addVideo,
  updateVideo: actions.updateVideo,
  reorderVideo: actions.reorderVideo,
  removeVideo: actions.removeVideo,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock("@/components/RichTextEditor", () => ({
  default: () => <div data-testid="rte" />,
}));

import WaveBuilder from "@/components/WaveBuilder";

const ID = "1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvW";
const link = `https://drive.google.com/file/d/${ID}/view`;

function week(videos: AdminWeek["videos"]): AdminWeek {
  return {
    id: "wk1",
    title: "Week 1",
    position: 1,
    description_html: null,
    materials: [],
    assignments: [],
    videos,
  };
}
function renderWith(videos: AdminWeek["videos"]) {
  const wave = {
    id: "w1",
    name: "July",
    description_html: null,
    type: "online" as const,
    created_at: "",
  };
  return render(<WaveBuilder existing={{ wave, weeks: [week(videos)] }} />);
}

beforeEach(() => vi.clearAllMocks());

describe("WaveBuilder — Videos section (US1)", () => {
  it("shows the empty state and the sharing helper copy when a week has no videos", () => {
    renderWith([]);
    expect(screen.getByText(strings.wavesVideosEmptyNote)).toBeInTheDocument();
    expect(screen.getByText(strings.wavesVideoLinkHelp)).toBeInTheDocument();
  });

  it("renders an existing video's title and an Open in Drive link", () => {
    renderWith([{ id: "v1", title: "Lesson 1", driveFileId: ID, position: 1 }]);
    expect(screen.getByText("Lesson 1")).toBeInTheDocument();
    const open = screen.getByRole("link", {
      name: strings.studentVideoOpenInDrive,
    });
    expect(open).toHaveAttribute(
      "href",
      `https://drive.google.com/file/d/${ID}/view`
    );
  });

  it("rejects a non-Drive link with an inline error and adds nothing", () => {
    renderWith([]);
    fireEvent.change(
      screen.getByLabelText(strings.wavesVideoTitlePlaceholder),
      { target: { value: "Intro" } }
    );
    fireEvent.change(
      screen.getByLabelText(strings.wavesVideoLinkPlaceholder),
      { target: { value: "https://example.com/x" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.wavesVideoAddLabel })
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      strings.wavesVideoLinkInvalid
    );
    // Still showing the empty state — nothing was added to the list.
    expect(screen.getByText(strings.wavesVideosEmptyNote)).toBeInTheDocument();
  });

  it("adds a valid video to the local draft list", () => {
    renderWith([]);
    fireEvent.change(
      screen.getByLabelText(strings.wavesVideoTitlePlaceholder),
      { target: { value: "New lesson" } }
    );
    fireEvent.change(
      screen.getByLabelText(strings.wavesVideoLinkPlaceholder),
      { target: { value: link } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.wavesVideoAddLabel })
    );
    expect(screen.getByText("New lesson")).toBeInTheDocument();
    expect(
      screen.queryByText(strings.wavesVideosEmptyNote)
    ).not.toBeInTheDocument();
  });

  it("removes an existing video via the removeVideo action", async () => {
    renderWith([{ id: "v1", title: "Lesson 1", driveFileId: ID, position: 1 }]);
    fireEvent.click(
      screen.getByRole("button", { name: strings.wavesVideoRemoveLabel })
    );
    await waitFor(() =>
      expect(actions.removeVideo).toHaveBeenCalledTimes(1)
    );
  });
});
