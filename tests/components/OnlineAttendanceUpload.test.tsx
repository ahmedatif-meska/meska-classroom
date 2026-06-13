import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

const importOnlineAttendance = vi.fn<
  (
    prev: unknown,
    fd: FormData
  ) => Promise<{
    error?: string;
    marked?: number;
    skipped?: { email: string; reason: "unmatched" | "already" }[];
  }>
>(async () => ({ marked: 1, skipped: [] }));
vi.mock("@/app/admin/attendance/actions", () => ({
  importOnlineAttendance: (prev: unknown, fd: FormData) =>
    importOnlineAttendance(prev, fd),
}));

import OnlineAttendanceUpload from "@/components/OnlineAttendanceUpload";

const waves = [
  {
    id: "online-new",
    name: "Online July 2026",
    weeks: [
      { id: "wk-1", label: "Week 1" },
      { id: "wk-2", label: "Week 2" },
    ],
  },
  { id: "online-empty", name: "Online Empty", weeks: [] },
];

function csvFile(content: string) {
  return new File([content], "attendance.csv", { type: "text/csv" });
}

beforeEach(() => {
  vi.clearAllMocks();
  importOnlineAttendance.mockResolvedValue({ marked: 1, skipped: [] });
});

describe("OnlineAttendanceUpload (US3)", () => {
  it("lists the online waves and follows the selection with weeks", async () => {
    const user = userEvent.setup();
    render(<OnlineAttendanceUpload waves={waves} />);
    const waveSelect = screen.getByLabelText(strings.attendanceWaveLabel);
    expect(
      within(waveSelect)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Online July 2026", "Online Empty"]);

    await user.selectOptions(waveSelect, "online-empty");
    expect(screen.getByText(strings.attendanceNoWeeksNote)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.attendanceImportLabel })
    ).toBeDisabled();
  });

  it("offers the fixed template download", () => {
    render(<OnlineAttendanceUpload waves={waves} />);
    expect(
      screen.getByRole("button", { name: strings.attendanceTemplateLabel })
    ).toBeInTheDocument();
  });

  it("parses a picked CSV and submits the email array", async () => {
    const user = userEvent.setup();
    render(<OnlineAttendanceUpload waves={waves} />);

    await user.upload(
      screen.getByLabelText(strings.attendanceUploadLabel),
      csvFile("email\na@example.com\nb@example.com\n")
    );
    expect(
      await screen.findByText(new RegExp(strings.attendanceCsvReadyNote))
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: strings.attendanceImportLabel })
    );
    expect(importOnlineAttendance).toHaveBeenCalledOnce();
    const fd = importOnlineAttendance.mock.calls[0][1];
    expect(fd.get("wave_id")).toBe("online-new");
    expect(fd.get("week_id")).toBe("wk-1");
    expect(JSON.parse(fd.get("emails") as string)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("renders the marked count and per-row skip reasons after an import", async () => {
    importOnlineAttendance.mockResolvedValueOnce({
      marked: 1,
      skipped: [
        { email: "b@example.com", reason: "already" },
        { email: "ghost@example.com", reason: "unmatched" },
      ],
    });
    const user = userEvent.setup();
    render(<OnlineAttendanceUpload waves={waves} />);
    await user.upload(
      screen.getByLabelText(strings.attendanceUploadLabel),
      csvFile("email\na@example.com\n")
    );
    await screen.findByText(new RegExp(strings.attendanceCsvReadyNote));
    await user.click(
      screen.getByRole("button", { name: strings.attendanceImportLabel })
    );

    expect(
      await screen.findByText(new RegExp(`1 ${strings.attendanceImportSummary}`))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(strings.attendanceSkippedAlready))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(strings.attendanceSkippedUnmatched))
    ).toBeInTheDocument();
  });

  it("shows a parse error for a malformed CSV and submits nothing", async () => {
    const user = userEvent.setup();
    render(<OnlineAttendanceUpload waves={waves} />);
    await user.upload(
      screen.getByLabelText(strings.attendanceUploadLabel),
      csvFile("name\nSomeone\n")
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(strings.attendanceCsvMissingHeader);
    expect(
      screen.getByRole("button", { name: strings.attendanceImportLabel })
    ).toBeDisabled();
    expect(importOnlineAttendance).not.toHaveBeenCalled();
  });
});
