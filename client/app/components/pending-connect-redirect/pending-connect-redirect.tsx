import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { clearPendingConnectRequest, readPendingConnectRequest } from "@/lib/pending-connect";

/**
 * Sends a logged-in user back to their pending /connect request (P3-12). Runs after login
 * and after the activation → login round trip: those land on /app/console, dropping the
 * connect query string, so the request id survives only in localStorage. Renders nothing
 * and does nothing when no unexpired pending request exists (AC3.11).
 */
export const PendingConnectRedirect = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const acted = useRef(false);

  useEffect(() => {
    if (acted.current || !isAuthenticated) return;
    const pending = readPendingConnectRequest();
    if (!pending) {
      acted.current = true;
      return;
    }
    acted.current = true;
    // Consume the hand-off before navigating: a later visit to /app must not bounce the user
    // back into a completed or failed connect request.
    clearPendingConnectRequest();
    navigate(`/connect?request=${encodeURIComponent(pending.requestId)}`, { replace: true });
  }, [isAuthenticated, navigate]);

  return null;
};
