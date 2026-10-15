"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { TransientStatus } from "@blocks-idp/data-access/gateway/hooks/use-transient-status";

/**
 * Renders a just-happened save/delete result in a footer's own idle-status
 * slot — falls back to `fallback` (e.g. "Unsaved changes" / "No changes")
 * once `status` clears itself. See `useTransientStatus` for why this exists
 * instead of a toast.
 */
export function InlineStatusMessage({
  status,
  fallback,
}: {
  status: TransientStatus | null;
  fallback: ReactNode;
}) {
  if (!status) return <>{fallback}</>;

  const Icon = status.kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        status.kind === "success"
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{status.message}</span>
    </span>
  );
}

