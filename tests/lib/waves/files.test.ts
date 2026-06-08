import { describe, it, expect, vi } from "vitest";
import {
  materialPath,
  submissionPath,
  signedUrl,
  MATERIALS_BUCKET,
  SUBMISSIONS_BUCKET,
} from "@/lib/waves/files";

describe("path builders (wave-id-first isolation invariant)", () => {
  it("materialPath puts the wave id as the first segment", () => {
    const p = materialPath("wave-1", "week-9", "abc", "pdf");
    expect(p).toBe("wave-1/week-9/abc.pdf");
    expect(p.split("/")[0]).toBe("wave-1");
  });

  it("submissionPath puts wave id first and student id third (deterministic)", () => {
    const p = submissionPath("wave-1", "asg-2", "stu-3", "docx");
    expect(p).toBe("wave-1/asg-2/stu-3/submission.docx");
    const segs = p.split("/");
    expect(segs[0]).toBe("wave-1"); // wave folder → Storage RLS [1]
    expect(segs[2]).toBe("stu-3"); // student folder → Storage RLS [3]
    // Re-uploads overwrite (same path for same assignment+student).
    expect(submissionPath("wave-1", "asg-2", "stu-3", "docx")).toBe(p);
  });

  it("exposes the private bucket names", () => {
    expect(MATERIALS_BUCKET).toBe("wave-materials");
    expect(SUBMISSIONS_BUCKET).toBe("assignment-submissions");
  });
});

describe("signedUrl", () => {
  function client(result: {
    data: { signedUrl: string } | null;
    error: unknown;
  }) {
    const createSignedUrl = vi.fn(async () => result);
    return {
      createSignedUrl,
      supabase: { storage: { from: vi.fn(() => ({ createSignedUrl })) } },
    };
  }

  it("returns null for an empty path without calling storage", async () => {
    const c = client({ data: { signedUrl: "x" }, error: null });
    expect(await signedUrl(c.supabase, MATERIALS_BUCKET, null)).toBeNull();
    expect(c.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns the signed url on success", async () => {
    const c = client({ data: { signedUrl: "https://signed/x" }, error: null });
    expect(
      await signedUrl(c.supabase, MATERIALS_BUCKET, "wave-1/week/x.pdf")
    ).toBe("https://signed/x");
  });

  it("returns null when storage denies (e.g. cross-wave)", async () => {
    const c = client({ data: null, error: { message: "denied" } });
    expect(
      await signedUrl(c.supabase, MATERIALS_BUCKET, "other-wave/week/x.pdf")
    ).toBeNull();
  });
});
