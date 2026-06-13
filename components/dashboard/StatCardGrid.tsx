import type { ReactNode } from "react";

/**
 * Responsive grid for the KPI cards (feature 013): one column at 320px, two from
 * sm, up to four on large screens. Server Component.
 */
export default function StatCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}
