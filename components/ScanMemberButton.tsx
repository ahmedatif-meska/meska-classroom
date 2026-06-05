"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { targetPathFromScan } from "@/lib/members/scan";
import strings from "@/lib/strings";

function CameraIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

const SCANNER_ID = "member-qr-scanner";

export default function ScanMemberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hold the active scanner so we can stop the camera on close/unmount.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null
  );
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError(null);
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded: string) => {
            if (handledRef.current) return;
            const path = targetPathFromScan(decoded);
            if (!path) {
              setError(strings.scanInvalid);
              return;
            }
            handledRef.current = true;
            void scanner.stop().then(() => router.push(path));
          },
          () => {
            // per-frame decode misses are expected; ignore.
          }
        );
      } catch {
        if (!cancelled) setError(strings.scanCameraError);
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner.clear());
      }
    };
  }, [open, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <CameraIcon />
        {strings.membersScanLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={strings.scanTitle}
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-ink">
                  {strings.scanTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {strings.scanInstruction}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.closeLabel}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                ✕
              </button>
            </div>

            <div
              id={SCANNER_ID}
              className="mt-4 overflow-hidden rounded-xl bg-ink/5"
            />

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {strings.cancelLabel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
