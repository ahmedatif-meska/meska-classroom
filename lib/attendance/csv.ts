import strings from "@/lib/strings";

/**
 * Pure parser/validator for the online-attendance CSV (feature 012, US3). The
 * template is a SINGLE `email` column; the file is read in the browser and only
 * the validated email array travels to the Server Action (research R4 — no file
 * bytes, no Storage). Kept Supabase-free so it is deterministically unit-tested.
 */

export type AttendanceCsvResult = { emails: string[] } | { error: string };

export function parseAttendanceCsv(text: string): AttendanceCsvResult {
  // Tolerate a UTF-8 BOM (Excel exports) and any line-ending style.
  const lines = (text ?? "").replace(/^﻿/, "").split(/\r\n|\r|\n/);

  // The first non-empty line must be exactly the single `email` header.
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length || lines[i].trim().toLowerCase() !== "email") {
    return { error: strings.attendanceCsvMissingHeader };
  }

  const emails: string[] = [];
  const seen = new Set<string>();
  for (let j = i + 1; j < lines.length; j++) {
    const raw = lines[j].trim();
    if (!raw) continue;
    // Any comma means extra columns — the template is single-column.
    if (raw.includes(",")) return { error: strings.attendanceCsvMissingHeader };
    const email = raw.toLowerCase();
    if (seen.has(email)) continue; // in-file duplicates collapse silently
    seen.add(email);
    emails.push(email);
  }

  if (emails.length === 0) return { error: strings.attendanceCsvEmpty };
  return { emails };
}
