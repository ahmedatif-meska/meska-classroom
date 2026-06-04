import { isValidEmail } from "@/lib/members/validation";
import strings from "@/lib/strings";

/**
 * Dependency-free parser + validator for the fixed bulk-upload template
 * (columns: Full Name, WhatsApp Number, Email). Runs on BOTH the client (fast
 * feedback) and the server (the trust boundary). Any blank/whitespace-only cell,
 * malformed email, wrong columns, or empty file rejects the WHOLE file (FR-012);
 * in-file duplicate emails are left to the action to skip + report (FR-015).
 */

export type CsvRow = { fullName: string; whatsapp: string; email: string };

export type CsvResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; error: string; badRows?: number[] };

const EXPECTED_HEADER = ["full name", "whatsapp number", "email"];

/** Minimal RFC4180-style parser: handles quoted fields, embedded commas, and "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseAndValidateMembersCsv(text: string): CsvResult {
  // Drop fully-blank lines (a stray newline), but keep ",,"-style rows so empty
  // cells are caught as a validation error rather than silently skipped.
  const matrix = parseCsv(text).filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
  if (matrix.length === 0) return { ok: false, error: strings.bulkInvalidCsv };

  const header = matrix[0].map((h) => h.trim().toLowerCase());
  if (
    header.length !== EXPECTED_HEADER.length ||
    !EXPECTED_HEADER.every((e, i) => header[i] === e)
  ) {
    return { ok: false, error: strings.bulkWrongColumns };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length === 0) return { ok: false, error: strings.bulkNoRows };

  const blankRows: number[] = [];
  const badEmailRows: number[] = [];
  const rows: CsvRow[] = [];

  dataRows.forEach((cells, idx) => {
    const rowNum = idx + 2; // header is line 1
    const fullName = (cells[0] ?? "").trim();
    const whatsapp = (cells[1] ?? "").trim();
    const email = (cells[2] ?? "").trim();

    if (cells.length < 3 || !fullName || !whatsapp || !email) {
      blankRows.push(rowNum);
      return;
    }
    if (!isValidEmail(email)) {
      badEmailRows.push(rowNum);
      return;
    }
    rows.push({ fullName, whatsapp, email });
  });

  if (blankRows.length) {
    return { ok: false, error: strings.bulkBlankCell, badRows: blankRows };
  }
  if (badEmailRows.length) {
    return { ok: false, error: strings.bulkBadEmail, badRows: badEmailRows };
  }
  return { ok: true, rows };
}
