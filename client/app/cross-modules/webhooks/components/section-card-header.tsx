import type { ReactNode } from "react";

interface SectionCardHeaderProps {
  title: string;
  /** Shown as a pill beside the title once known. */
  count?: number;
  children?: ReactNode;
}

/** The header bar of a section card on the webhook detail page: title, count and controls. */
export function SectionCardHeader({ title, count, children }: Readonly<SectionCardHeaderProps>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-high-emphasis">{title}</h2>
        {count === undefined ? null : (
          <span className="rounded-full bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
