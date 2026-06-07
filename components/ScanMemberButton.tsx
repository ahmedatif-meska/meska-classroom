"use client";

import { useEffect, useRef, useState } from "react";
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

/** Map a getUserMedia/html5-qrcode failure to a precise, actionable message. */
function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  const text = `${name} ${(e as { message?: string })?.message ?? String(e ?? "")}`
    .toLowerCase();
  if (/notallowed|permission|denied|security/.test(text)) {
    return strings.scanPermissionDenied;
  }
  if (/notreadable|in use|busy|abort|trackstart|notreadableerror/.test(text)) {
    return strings.scanCameraBusy;
  }
  if (/notfound|overconstrained|no camera|devices/.test(text)) {
    return strings.scanNoCamera;
  }
  return strings.scanCameraError;
}

export default function ScanMemberButton() {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Hold the active scanner so we can stop the camera on close/unmount.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null
  );
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
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
            // Stop the camera, then do a FULL-PAGE navigation (not router.push):
            // a client-side nav would unmount this page while html5-qrcode is still
            // tearing down its <video>, and that race throws into the error
            // boundary ("Something went wrong"). A document navigation lets the
            // browser drop the camera/page cleanly and loads the target via SSR.
            const go = () => window.location.assign(path);
            scanner.stop().then(go, go);
          },
          () => {
            // per-frame decode misses are expected; ignore.
          }
        );
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        // Release the camera fully so it isn't left "in use" for the next attempt.
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // clear() can throw if the scanner is mid-teardown — safe to ignore.
            }
          });
      }
    };
  }, [open, attempt]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
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
              <div className="mt-4">
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAttempt((a) => a + 1);
                  }}
                  className="mt-3 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {strings.scanRetryLabel}
                </button>
              </div>
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
