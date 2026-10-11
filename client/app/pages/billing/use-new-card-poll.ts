import { useCallback, useEffect, useRef, useState } from "react";
import { billingService } from "@blocks-identifier/services/billing.service";

/**
 * Waits for a just-added card to show up.
 *
 * The card is filed from the provider's signed notification, not from the browser, so it lands a
 * moment after the form closes. Re-read every `intervalMs` until a card id appears that was not
 * there before, or give up after `timeoutMs` and say so — never assume it is there.
 */

export type CardPollStatus = "idle" | "waiting" | "found" | "timeout";

export const CARD_POLL_INTERVAL_MS = 1500;
export const CARD_POLL_TIMEOUT_MS = 30_000;

export function useNewCardPoll(
  tenantGroupId: string | undefined,
  onFound: () => void | Promise<void>,
  intervalMs = CARD_POLL_INTERVAL_MS,
  timeoutMs = CARD_POLL_TIMEOUT_MS,
) {
  const [status, setStatus] = useState<CardPollStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped on every start and on unmount, so a late answer from an older run is ignored. */
  const run = useRef(0);
  const onFoundRef = useRef(onFound);

  useEffect(() => {
    onFoundRef.current = onFound;
  }, [onFound]);

  const stop = useCallback(() => {
    run.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (knownIds: string[]) => {
      if (!tenantGroupId) return;
      stop();
      const mine = run.current;
      const known = new Set(knownIds);
      const maxTicks = Math.max(1, Math.floor(timeoutMs / intervalMs));
      let ticks = 0;
      setStatus("waiting");

      const tick = async () => {
        ticks += 1;
        try {
          const response = await billingService.getCards(tenantGroupId);
          if (run.current !== mine) return;
          if ((response?.cards ?? []).some((card) => !known.has(card.paymentMethodId))) {
            setStatus("found");
            await onFoundRef.current();
            return;
          }
        } catch {
          // One failed read is not the end; the next tick tries again.
          if (run.current !== mine) return;
        }
        if (ticks >= maxTicks) {
          setStatus("timeout");
          return;
        }
        timer.current = setTimeout(() => void tick(), intervalMs);
      };

      timer.current = setTimeout(() => void tick(), intervalMs);
    },
    [tenantGroupId, intervalMs, timeoutMs, stop],
  );

  return { status, start, stop };
}
