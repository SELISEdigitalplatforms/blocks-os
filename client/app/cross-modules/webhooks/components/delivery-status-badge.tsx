import { useT } from "@seliseblocks/genesis-os";
import { Badge } from "@/components/ui-kits/badge/badge";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { DeliveryStatus } from "../models/webhook.model";

const VARIANTS = {
  Pending: "info",
  Retrying: "warning",
  Delivered: "success",
  Failed: "error",
  Skipped: "secondary",
} as const;

export function DeliveryStatusBadge({ status }: Readonly<{ status: DeliveryStatus }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const labels: Record<DeliveryStatus, string> = {
    Pending: t("HISTORY.STATUS_PENDING"),
    Retrying: t("HISTORY.STATUS_RETRYING"),
    Delivered: t("HISTORY.STATUS_DELIVERED"),
    Failed: t("HISTORY.STATUS_FAILED"),
    Skipped: t("HISTORY.STATUS_SKIPPED"),
  };
  return <Badge variant={VARIANTS[status]}>{labels[status]}</Badge>;
}
