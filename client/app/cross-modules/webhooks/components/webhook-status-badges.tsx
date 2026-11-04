import { useT } from "@seliseblocks/genesis-os";
import { Badge } from "@/components/ui-kits/badge/badge";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhook } from "../models/webhook.model";

/** "Active" or "Off", plus a red badge when the webhook is failing or was turned off by errors. */
export function WebhookStatusBadges({ webhook }: Readonly<{ webhook: IWebhook }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const isFailing = webhook.consecutiveFailures > 0;
  const failedLabel = isFailing
    ? t("LIST.FAILED_COUNT", { count: webhook.consecutiveFailures })
    : t("LIST.AUTO_OFF");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={webhook.isActive ? "success" : "secondary"}>
        {webhook.isActive ? t("LIST.ACTIVE") : t("LIST.OFF")}
      </Badge>
      {(isFailing || webhook.disabledReason) && <Badge variant="error">{failedLabel}</Badge>}
    </div>
  );
}
