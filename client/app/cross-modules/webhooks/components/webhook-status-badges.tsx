import { useT } from "@seliseblocks/genesis-os";
import { Badge } from "@/components/ui-kits/badge/badge";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhook } from "../models/webhook.model";

/**
 * "Active" or "Off", plus a red badge when the webhook is failing or was turned off by errors.
 * A turned-off webhook keeps its failure count, so the turn-off reason wins over "N failed".
 */
export function WebhookStatusBadges({ webhook }: Readonly<{ webhook: IWebhook }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const isFailing = webhook.consecutiveFailures > 0;
  const failedLabel = webhook.disabledReason
    ? t("LIST.AUTO_OFF")
    : t("LIST.FAILED_COUNT", { count: webhook.consecutiveFailures });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={webhook.isActive ? "success" : "secondary"}>
        {webhook.isActive ? t("LIST.ACTIVE") : t("LIST.OFF")}
      </Badge>
      {(isFailing || webhook.disabledReason) && <Badge variant="error">{failedLabel}</Badge>}
    </div>
  );
}
