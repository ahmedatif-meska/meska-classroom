import { describe, it, expect } from "vitest";
import {
  parseDriveFileId,
  driveEmbedUrl,
  driveWatchUrl,
  MAX_VIDEO_TITLE_LEN,
} from "@/lib/waves/video";

// A realistic Google Drive file id (33 chars, the common modern length).
const ID = "1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvW";

describe("parseDriveFileId", () => {
  it("extracts the id from a /file/d/<id>/view share link", () => {
    expect(
      parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)
    ).toBe(ID);
  });

  it("extracts the id from a /file/d/<id>/preview link", () => {
    expect(
      parseDriveFileId(`https://drive.google.com/file/d/${ID}/preview`)
    ).toBe(ID);
  });

  it("extracts the id from an open?id=<id> link", () => {
    expect(
      parseDriveFileId(`https://drive.google.com/open?id=${ID}`)
    ).toBe(ID);
  });

  it("extracts the id from a uc?id=<id>&export=download link", () => {
    expect(
      parseDriveFileId(`https://drive.google.com/uc?id=${ID}&export=download`)
    ).toBe(ID);
  });

  it("accepts a bare file id", () => {
    expect(parseDriveFileId(ID)).toBe(ID);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseDriveFileId(`   ${ID}   `)).toBe(ID);
  });

  it("rejects a non-Drive host", () => {
    expect(parseDriveFileId(`https://example.com/file/d/${ID}/view`)).toBeNull();
    expect(
      parseDriveFileId("https://youtube.com/watch?v=abcdEFGHijk")
    ).toBeNull();
  });

  it("rejects empty / nullish input", () => {
    expect(parseDriveFileId("")).toBeNull();
    expect(parseDriveFileId("   ")).toBeNull();
    expect(parseDriveFileId(null)).toBeNull();
    expect(parseDriveFileId(undefined)).toBeNull();
  });

  it("rejects an id containing illegal characters", () => {
    expect(parseDriveFileId("has a space inside")).toBeNull();
    expect(parseDriveFileId("short")).toBeNull();
    expect(parseDriveFileId("bad/id$with*chars")).toBeNull();
  });
});

describe("driveEmbedUrl / driveWatchUrl", () => {
  it("builds the canonical preview (embed) url", () => {
    expect(driveEmbedUrl(ID)).toBe(
      `https://drive.google.com/file/d/${ID}/preview`
    );
  });

  it("builds the canonical open-in-Drive url", () => {
    expect(driveWatchUrl(ID)).toBe(
      `https://drive.google.com/file/d/${ID}/view`
    );
  });
});

describe("MAX_VIDEO_TITLE_LEN", () => {
  it("is 200", () => {
    expect(MAX_VIDEO_TITLE_LEN).toBe(200);
  });
});
