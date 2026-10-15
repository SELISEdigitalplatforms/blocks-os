import { useCallback, useEffect, useRef, useState } from "react";
import { handleErrorMessages } from "@/lib/error";

export interface TransientStatus {
  kind: "success" | "error";
  message: string;
}

const DEFAULT_DURATION_MS = 4000;

/**
 * A save/delete result that shows inline, next to the button that caused it,
 * for `duration` ms, then clears itself.
 *
 * The shared toast viewport docks to the bottom-right of the viewport, which
 * is exactly where a docked panel's own footer (and its Save button) sits —
 * a toast reporting that save covers the very button it's reporting on. This
 * is the panel-local alternative: render `status` in the footer's existing
 * idle-text slot (see `InlineStatusMessage`) instead of firing a toast.
 */
export function useTransientStatus(duration = DEFAULT_DURATION_MS) {
  const [status, setStatus] = useState<TransientStatus | null>(null);
  // React 19 requires an explicit initial value; `useRef<T>()` no longer
  // implies `T | undefined`.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const showStatus = useCallback(
    (next: TransientStatus | null) => {
      clearTimeout(timeoutRef.current);
      setStatus(next);
      if (next) {
        timeoutRef.current = setTimeout(() => setStatus(null), duration);
      }
    },
    [duration],
  );

  const setSuccess = useCallback(
    (message: string) => showStatus({ kind: "success", message }),
    [showStatus],
  );

  /** Mirrors `showErrorToast`'s own `errors` normalization, so switching a
   *  call site from the toast to this hook is a drop-in swap. */
  const setError = useCallback(
    (errors: unknown, fallback = "Something went wrong.") => {
      const normalized = handleErrorMessages(errors);
      const message = Array.isArray(normalized) ? normalized.join(" ") : normalized || fallback;
      showStatus({ kind: "error", message });
    },
    [showStatus],
  );

  return { status, setStatus: showStatus, setSuccess, setError } as const;
}

