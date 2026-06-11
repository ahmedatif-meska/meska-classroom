"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { reportClientError } from "@/app/actions";
import { buildClientErrorReport } from "@/lib/errors/report";

/**
 * Fire-and-forget crash reporting for `error.tsx` boundaries (feature 009,
 * US3.1). Reports once per error instance; every failure path is swallowed so
 * the error screen's retry UX is never affected (offline/blocked included).
 */
export function useReportClientError(error: Error) {
  const pathname = usePathname();

  useEffect(() => {
    try {
      void reportClientError(buildClientErrorReport(error, pathname ?? "")).catch(
        () => {
          /* best-effort — the recovery UX must not care */
        }
      );
    } catch {
      /* never interfere with the boundary */
    }
  }, [error, pathname]);
}
