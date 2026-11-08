import { useT } from "@seliseblocks/genesis-os";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhookDelivery } from "../models/webhook.model";
import { formatDateTime, prettyJson } from "../utils/format";

/** Attempts and the exact event that was sent, side by side. */
export function DeliveryDetails({ delivery }: Readonly<{ delivery: IWebhookDelivery }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("HISTORY.ATTEMPTS")}
        </h4>
        {delivery.attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("HISTORY.NO_ATTEMPTS")}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-xs">
            {delivery.attempts.map((attempt) => (
              <li key={attempt.no} className="flex flex-wrap gap-x-3 font-mono">
                <span>#{attempt.no}</span>
                <span>{formatDateTime(attempt.at)}</span>
                <span>{attempt.httpStatus === null ? "-" : `HTTP ${attempt.httpStatus}`}</span>
                <span>{t("HISTORY.DURATION_MS", { ms: attempt.durationMs })}</span>
                {attempt.errorCode && <span className="text-error">{attempt.errorCode}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="min-w-0">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("HISTORY.SENT_BODY")}
        </h4>
        <pre className="max-h-64 overflow-auto rounded-sm border border-border bg-background p-3 text-xs">
          <code>{prettyJson(delivery.body)}</code>
        </pre>
      </div>
    </div>
  );
}
