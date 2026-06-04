import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RichTextEditor from "@/components/RichTextEditor";
import strings from "@/lib/strings";

describe("RichTextEditor (US2.1)", () => {
  it("renders labelled toolbar controls and the editable region", () => {
    render(<RichTextEditor />);
    expect(screen.getByRole("button", { name: strings.rteBold })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: strings.rteItalic })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.rteUnderline })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.rteBulletList })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.rteNumberList })
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: strings.rteFontSize })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: strings.rteFontFamily })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `${strings.rteTextColor}: ${strings.rteColorBrand}`,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("seeds the hidden field from initialHtml", () => {
    const { container } = render(<RichTextEditor initialHtml="<p>seed</p>" />);
    const hidden = container.querySelector(
      'input[name="description_html"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("<p>seed</p>");
  });

  it("mirrors edited content into the hidden field on input", () => {
    const { container } = render(<RichTextEditor />);
    const editor = screen.getByRole("textbox");
    editor.innerHTML = "<strong>Hi</strong>";
    fireEvent.input(editor);
    const hidden = container.querySelector(
      'input[name="description_html"]'
    ) as HTMLInputElement;
    expect(hidden.value).toBe("<strong>Hi</strong>");
  });

  it("does not throw when a formatting button is clicked", () => {
    render(<RichTextEditor />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: strings.rteBold }))
    ).not.toThrow();
  });
});
