import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { billingService } from "@blocks-identifier/services/billing.service";

/**
 * Adds a card through the provider's own form.
 *
 * The number, expiry and security code are typed into Adyen's component and sent straight to
 * Adyen. They never reach a Blocks server, which is why there is no card form of our own here and
 * why this dialog has no fields.
 *
 * Nothing is filed when the form succeeds either. Adyen sends a signed notification carrying the
 * token, and that is what creates the card — so a forged "it worked" from this browser achieves
 * nothing. The list refreshes a moment later, once that notification has arrived.
 */

const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@adyen/adyen-web@5.66.1/dist/adyen.js";
const STYLE_URL = "https://cdn.jsdelivr.net/npm/@adyen/adyen-web@5.66.1/dist/adyen.css";

declare global {
  interface Window {
    AdyenCheckout?: (options: Record<string, unknown>) => Promise<{
      create: (type: string) => { mount: (target: HTMLElement) => void };
    }>;
  }
}

/** Loads Adyen's component once and reuses it. */
function useAdyenScript(enabled: boolean) {
  const [ready, setReady] = useState(() => typeof window !== "undefined" && !!window.AdyenCheckout);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || ready) return;

    if (!document.querySelector(`link[href="${STYLE_URL}"]`)) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = STYLE_URL;
      document.head.appendChild(style);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);

    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      existing.addEventListener("error", () => setFailed(true));
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);
  }, [enabled, ready]);

  return { ready, failed };
}

interface AddCardDialogProps {
  tenantGroupId: string;
  market?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the provider form completes, so the list can be re-read. */
  onCompleted?: () => void;
}

export function AddCardDialog({
  tenantGroupId,
  market = "CHF",
  open,
  onOpenChange,
  onCompleted,
}: AddCardDialogProps) {
  const mountPoint = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { ready, failed } = useAdyenScript(open);

  useEffect(() => {
    if (!open || !ready || !mountPoint.current) return;

    let cancelled = false;
    setBusy(true);
    setError(null);

    (async () => {
      try {
        const { session } = await billingService.createCardSession(
          tenantGroupId,
          market,
          window.location.href,
        );

        if (cancelled) return;

        if (!session.isSuccess) {
          setError(
            session.reason === "gateway_not_configured"
              ? "Card payments are not configured for this environment yet."
              : "The card form could not be opened. Try again in a moment.",
          );
          return;
        }

        const checkout = await window.AdyenCheckout!({
          environment: session.environment,
          clientKey: session.clientKey,
          session: { id: session.sessionId, sessionData: session.sessionData },
          onPaymentCompleted: () => {
            // The card is filed from Adyen's signed notification, not from here. Closing and
            // re-reading is all this callback is good for.
            onOpenChange(false);
            onCompleted?.();
          },
          onError: () => setError("The card could not be saved. Check the details and try again."),
        });

        if (!cancelled && mountPoint.current) {
          checkout.create("card").mount(mountPoint.current);
        }
      } catch {
        if (!cancelled) setError("The card form could not be opened.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, ready, tenantGroupId, market, onOpenChange, onCompleted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a card</DialogTitle>
          <DialogDescription>
            Your card details go straight to our payment provider. Blocks never sees the number.
          </DialogDescription>
        </DialogHeader>

        {failed && (
          <p className="text-sm text-destructive">
            The payment form could not be loaded. Check your connection and try again.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {busy && !error && <p className="text-sm text-muted-foreground">Opening the card form…</p>}

        <div ref={mountPoint} />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
