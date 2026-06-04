"use client";

import { useEffect, useRef, useState } from "react";
import strings from "@/lib/strings";
import {
  FONT_SIZE_CLASSES,
  FONT_COLOR_CLASSES,
  FONT_FAMILY_CLASSES,
} from "@/lib/instructors/sanitize";

/**
 * Minimal rich-text editor — a `contentEditable` surface plus a toolbar
 * (bold/italic/underline, lists, alignment, indent, link, size/font/color). No
 * editor framework (research R1). The authored HTML mirrors into a hidden field
 * so it posts with the form; the SERVER sanitizes it before persistence
 * (FR-009), so editor quirks can never produce unsafe stored markup.
 *
 * Inline emphasis uses tags (<b>/<i>/<u>); size/font/color wrap the selection in
 * a class-carrying <span>; alignment/indent emit constrained inline styles —
 * all of which the sanitizer's allowlists keep, dropping everything else.
 */

// Numeric size labels derived from the authoritative class list ("rte-fs-12" → "12").
const FONT_SIZES = FONT_SIZE_CLASSES.map((cls) => ({
  cls,
  label: cls.replace("rte-fs-", ""),
}));

const FONT_FAMILIES: { cls: (typeof FONT_FAMILY_CLASSES)[number]; label: string }[] = [
  { cls: "rte-ff-sans", label: strings.rteFontFamilySans },
  { cls: "rte-ff-serif", label: strings.rteFontFamilySerif },
  { cls: "rte-ff-mono", label: strings.rteFontFamilyMono },
];

const COLORS: {
  cls: (typeof FONT_COLOR_CLASSES)[number];
  label: string;
  swatch: string;
}[] = [
  { cls: "rte-c-ink", label: strings.rteColorInk, swatch: "var(--color-ink)" },
  { cls: "rte-c-brand", label: strings.rteColorBrand, swatch: "var(--color-brand)" },
  { cls: "rte-c-red", label: strings.rteColorRed, swatch: "#dc2626" },
  { cls: "rte-c-green", label: strings.rteColorGreen, swatch: "#16a34a" },
  { cls: "rte-c-amber", label: strings.rteColorAmber, swatch: "#d97706" },
  { cls: "rte-c-purple", label: strings.rteColorPurple, swatch: "#7c3aed" },
];

const ICON = "h-4 w-4";

function AlignIcon({ variant }: { variant: "left" | "center" | "right" }) {
  // Short lines anchored to the chosen side convey the alignment.
  const x2 = variant === "left" ? 14 : variant === "center" ? 17 : 20;
  const x1 = variant === "right" ? 10 : variant === "center" ? 7 : 4;
  return (
    <svg viewBox="0 0 24 24" className={ICON} stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1={x1} y1="12" x2={x2} y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function IndentIcon({ outdent = false }: { outdent?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={ICON} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      {outdent ? <polyline points="7,9 4,12 7,15" /> : <polyline points="4,9 7,12 4,15" />}
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ToolbarButton({
  label,
  onApply,
  children,
}: {
  label: string;
  onApply: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the editor's selection: prevent the button from stealing focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onApply}
      className="flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold text-ink hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  name = "description_html",
  initialHtml = "",
  label = strings.instructorDescriptionLabel,
}: {
  name?: string;
  initialHtml?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [html, setHtml] = useState(initialHtml);
  const [sizeValue, setSizeValue] = useState("");
  const [familyValue, setFamilyValue] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Seed the editor's content once (contentEditable can't use defaultValue).
  useEffect(() => {
    if (ref.current && initialHtml) ref.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    if (ref.current) setHtml(ref.current.innerHTML);
  };

  // Remember the selection while it still lives inside the editor, so controls
  // that take focus (native <select>, the link input) can restore it first.
  const rememberSelection = () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (ref.current?.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const doExec = (command: string, value?: string) => {
    try {
      document.execCommand(command, false, value);
    } catch {
      /* no-op in environments without execCommand */
    }
    ref.current?.focus();
    sync();
  };

  // Inline emphasis/lists — keep semantic tags (<b>/<i>/<u>/<ul>…).
  const exec = (command: string) => {
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* ignore */
    }
    doExec(command);
  };

  // Block formatting (align/indent) — emit CSS the sanitizer keeps.
  const execBlock = (command: string) => {
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* ignore */
    }
    doExec(command);
  };

  // Wrap the current (or last-remembered) selection in a span with `cls`.
  const wrapSelectionInClass = (cls: string) => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel) return;

    const liveOk =
      sel.rangeCount > 0 &&
      !sel.isCollapsed &&
      Boolean(ref.current?.contains(sel.getRangeAt(0).commonAncestorContainer));

    // The live selection was collapsed by a dropdown taking focus — restore it.
    if (!liveOk && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }

    if (sel.rangeCount === 0 || sel.isCollapsed) {
      ref.current?.focus();
      return; // nothing selected — applying a style needs a selection
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.className = cls;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    } catch {
      return;
    }
    sel.removeAllRanges();
    savedRange.current = null;
    ref.current?.focus();
    sync();
  };

  const openLink = () => {
    rememberSelection();
    setLinkUrl("");
    setLinkOpen(true);
  };

  // In a contentEditable, clicking an anchor only moves the caret — so open the
  // link ourselves in a new tab, making authored links actually clickable.
  const onEditorClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (href) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const applyLink = () => {
    const raw = linkUrl.trim();
    setLinkOpen(false);
    setLinkUrl("");
    if (!raw) return;
    const url = /^(https?:|mailto:)/i.test(raw) ? raw : `https://${raw}`;
    restoreSelection();
    ref.current?.focus();
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      doExec("createLink", url);
    } else {
      const esc = url
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      doExec("insertHTML", `<a href="${esc}">${esc}</a>`);
    }
    savedRange.current = null;
  };

  const toolbarLabelId = `${name}-toolbar`;

  const selectClass =
    "h-8 rounded-md border border-slate-200 bg-surface px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const divider = (
    <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
  );

  return (
    <div className="flex flex-col gap-2">
      <span id={`${name}-label`} className="text-sm font-bold text-ink">
        {label}
      </span>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-page">
        <div
          role="toolbar"
          aria-label={toolbarLabelId}
          className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5"
        >
          <ToolbarButton label={strings.rteBold} onApply={() => exec("bold")}>
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton label={strings.rteItalic} onApply={() => exec("italic")}>
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteUnderline}
            onApply={() => exec("underline")}
          >
            <span className="underline">U</span>
          </ToolbarButton>
          {divider}
          <ToolbarButton
            label={strings.rteBulletList}
            onApply={() => exec("insertUnorderedList")}
          >
            •≡
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteNumberList}
            onApply={() => exec("insertOrderedList")}
          >
            1≡
          </ToolbarButton>
          {divider}
          <ToolbarButton
            label={strings.rteAlignLeft}
            onApply={() => execBlock("justifyLeft")}
          >
            <AlignIcon variant="left" />
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteAlignCenter}
            onApply={() => execBlock("justifyCenter")}
          >
            <AlignIcon variant="center" />
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteAlignRight}
            onApply={() => execBlock("justifyRight")}
          >
            <AlignIcon variant="right" />
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteOutdent}
            onApply={() => execBlock("outdent")}
          >
            <IndentIcon outdent />
          </ToolbarButton>
          <ToolbarButton
            label={strings.rteIndent}
            onApply={() => execBlock("indent")}
          >
            <IndentIcon />
          </ToolbarButton>
          {divider}
          <ToolbarButton label={strings.rteLink} onApply={openLink}>
            <LinkIcon />
          </ToolbarButton>
          {divider}

          <label className="sr-only" htmlFor={`${name}-fontsize`}>
            {strings.rteFontSize}
          </label>
          <select
            id={`${name}-fontsize`}
            aria-label={strings.rteFontSize}
            value={sizeValue}
            onMouseDown={rememberSelection}
            onFocus={rememberSelection}
            onChange={(e) => {
              setSizeValue(e.target.value);
              if (e.target.value) wrapSelectionInClass(e.target.value);
            }}
            className={selectClass}
          >
            <option value="" disabled>
              {strings.rteFontSize}
            </option>
            {FONT_SIZES.map(({ cls, label: size }) => (
              <option key={cls} value={cls}>
                {size}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor={`${name}-fontfamily`}>
            {strings.rteFontFamily}
          </label>
          <select
            id={`${name}-fontfamily`}
            aria-label={strings.rteFontFamily}
            value={familyValue}
            onMouseDown={rememberSelection}
            onFocus={rememberSelection}
            onChange={(e) => {
              setFamilyValue(e.target.value);
              if (e.target.value) wrapSelectionInClass(e.target.value);
            }}
            className={selectClass}
          >
            <option value="" disabled>
              {strings.rteFontFamily}
            </option>
            {FONT_FAMILIES.map(({ cls, label: fam }) => (
              <option key={cls} value={cls}>
                {fam}
              </option>
            ))}
          </select>

          {divider}
          <span
            role="group"
            aria-label={strings.rteTextColor}
            className="flex items-center gap-1"
          >
            {COLORS.map(({ cls, label: colorName, swatch }) => (
              <button
                key={cls}
                type="button"
                aria-label={`${strings.rteTextColor}: ${colorName}`}
                title={`${strings.rteTextColor}: ${colorName}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => wrapSelectionInClass(cls)}
                className="h-6 w-6 rounded-full border border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                style={{ backgroundColor: swatch }}
              />
            ))}
          </span>
        </div>

        {linkOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-surface px-2 py-2">
            <label className="sr-only" htmlFor={`${name}-linkurl`}>
              {strings.rteLinkUrlLabel}
            </label>
            <input
              id={`${name}-linkurl`}
              type="url"
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  setLinkOpen(false);
                  setLinkUrl("");
                }
              }}
              placeholder={strings.rteLinkPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-slate-200 bg-page px-3 py-1.5 text-base text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            <button
              type="button"
              onClick={applyLink}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {strings.rteLinkAdd}
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkOpen(false);
                setLinkUrl("");
              }}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {strings.cancelLabel}
            </button>
          </div>
        ) : null}

        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${name}-label`}
          onInput={sync}
          onMouseUp={rememberSelection}
          onKeyUp={rememberSelection}
          onClick={onEditorClick}
          className="instructor-rte h-40 w-full overflow-y-auto break-words px-4 py-3 text-base text-ink focus:outline-none"
        />
      </div>
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
