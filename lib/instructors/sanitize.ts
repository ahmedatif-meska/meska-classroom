import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML sanitizer for the instructor rich-text description — the
 * FR-009 trust boundary. Runs in the create/update Server Actions BEFORE the
 * value is persisted, and again on render as defense-in-depth, so the database
 * never holds unsafe markup.
 *
 * Allowlist (research R2/R3): inline emphasis + lists + paragraphs, plus a
 * `span` carrying ONLY classes from the closed font-size / color / font-family
 * sets. Everything else — scripts, event handlers, `javascript:` URLs, inline
 * styles, arbitrary tags/attributes/classes — is discarded. Open-ended styling
 * (arbitrary colors/sizes via inline style) is deliberately NOT allowed: the
 * editor offers a curated, brand-consistent palette only.
 */

/** The closed set of font-size classes the editor may apply (defined in globals.css). */
export const FONT_SIZE_CLASSES = [
  "rte-fs-12",
  "rte-fs-14",
  "rte-fs-16",
  "rte-fs-18",
  "rte-fs-24",
  "rte-fs-32",
] as const;

/** The closed set of text-color classes the editor may apply (defined in globals.css). */
export const FONT_COLOR_CLASSES = [
  "rte-c-ink",
  "rte-c-brand",
  "rte-c-red",
  "rte-c-green",
  "rte-c-amber",
  "rte-c-purple",
] as const;

/** The closed set of font-family classes the editor may apply (defined in globals.css). */
export const FONT_FAMILY_CLASSES = [
  "rte-ff-sans",
  "rte-ff-serif",
  "rte-ff-mono",
] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "b",
    "strong",
    "i",
    "em",
    "u",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "span",
    "a",
    "div",
    "blockquote",
  ],
  allowedAttributes: {
    span: ["class"],
    a: ["href", "target", "rel"],
    // `style` is allowed on any tag but tightly filtered by allowedStyles below
    // (only alignment + indent survive — no arbitrary inline styling).
    "*": ["style"],
  },
  allowedClasses: {
    span: [
      ...FONT_SIZE_CLASSES,
      ...FONT_COLOR_CLASSES,
      ...FONT_FAMILY_CLASSES,
    ],
  },
  // Block formatting only: text alignment and indentation. Values are matched
  // against strict regexes, so no url()/expression()/script can slip through.
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      margin: [/^[\d.\spxemr%]+$/],
      "margin-left": [/^[\d.pxemr%]+$/],
      "padding-left": [/^[\d.pxemr%]+$/],
    },
  },
  // Links (e.g. instructor social profiles) — safe schemes only. They render as
  // real, clickable anchors that open in a new tab.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer",
    }),
  },
  disallowedTagsMode: "discard",
};

/** Sanitize a submitted description to the allowlist; returns safe HTML (possibly ""). */
export function sanitizeDescription(
  input: FormDataEntryValue | null | undefined
): string {
  const raw = typeof input === "string" ? input : "";
  if (!raw.trim()) return "";
  return sanitizeHtml(raw, OPTIONS).trim();
}
