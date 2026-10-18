"use client";

import { cn } from "@/lib/utils";
import type { TransientStatus } from "@blocks-idp/data-access/gateway/hooks/use-transient-status";
import { InlineStatusMessage } from "./inline-status-message";

/**
 * A save/delete result shown as its own bar directly above the section it
 * reports on — typically a footer's Save/Cancel row — instead of as inline
 * text inside that row or a toast. A toast would sit on top of the very
 * button it's reporting on (the shared viewport docks bottom-right, right
 * where these docked panels put their own footer); a snackbar above the
 * footer stays visible without covering anything, and without needing
 * whatever's below it to stay mounted the way inline footer text would.
 */
export function StatusSnackbar({ status }: Readonly<{ status: TransientStatus | null }>) {
  if (!status) return null;

  return (
    <div
      className={cn(
        "shrink-0 rounded-sm border px-3 py-2 text-xs",
        status.kind === "success"
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-destructive/30 bg-destructive/10",
      )}
    >
      <InlineStatusMessage status={status} fallback={null} />
    </div>
  );
}

