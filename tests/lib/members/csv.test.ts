import { describe, it, expect } from "vitest";
import { parseAndValidateMembersCsv } from "@/lib/members/csv";
import strings from "@/lib/strings";

const HEADER = "Full Name,WhatsApp Number,Email";

describe("parseAndValidateMembersCsv (US5.1)", () => {
  it("parses valid rows, including quoted fields with commas", () => {
    const csv = `${HEADER}\n"Ali, Mona",+201111,mona@example.com\nSara Adel,+201222,sara@example.com\n`;
    const result = parseAndValidateMembersCsv(csv);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toEqual([
        { fullName: "Ali, Mona", whatsapp: "+201111", email: "mona@example.com" },
        { fullName: "Sara Adel", whatsapp: "+201222", email: "sara@example.com" },
      ]);
    }
  });

  it("rejects the whole file when any required cell is blank/whitespace", () => {
    const csv = `${HEADER}\nMona,+201,mona@example.com\nSara, ,sara@example.com\n`;
    const result = parseAndValidateMembersCsv(csv);
    expect(result).toEqual({
      ok: false,
      error: strings.bulkBlankCell,
      badRows: [3],
    });
  });

  it("rejects the whole file when an email is malformed", () => {
    const csv = `${HEADER}\nMona,+201,not-an-email\n`;
    const result = parseAndValidateMembersCsv(csv);
    expect(result).toEqual({
      ok: false,
      error: strings.bulkBadEmail,
      badRows: [2],
    });
  });

  it("rejects a file whose columns don't match the template", () => {
    const csv = `Name,Phone\nMona,+201\n`;
    const result = parseAndValidateMembersCsv(csv);
    expect(result).toEqual({ ok: false, error: strings.bulkWrongColumns });
  });

  it("rejects a header-only file (no member rows)", () => {
    const result = parseAndValidateMembersCsv(`${HEADER}\n`);
    expect(result).toEqual({ ok: false, error: strings.bulkNoRows });
  });
});
