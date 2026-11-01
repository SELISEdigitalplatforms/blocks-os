import React from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { MagicUrl } from "@blocks-utilities/models/magic-url.model";
import { useT } from "@seliseblocks/genesis-os";
export function MagicUrlStatusBadge({ item }: { item: MagicUrl }) {
  const { t } = useT("os.utilities");
  const getStatus = (item: MagicUrl) => {
    if (item.status) {
      switch (item.status) {
        case "Active":
          return { label: t("MAGIC_URL_STATUS_BADGE.ACTIVE"), variant: "success" };
        case "Inactive":
        case "Disabled":
          return { label: item.status, variant: "error" };
        case "Expired":
          return { label: t("MAGIC_URL_STATUS_BADGE.EXPIRED"), variant: "error" };
        default:
          return { label: item.status, variant: "secondary" };
      }
    }
    const now = new Date();
    const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
    if (item.expiredReason === "ManuallyDisabled") {
      return { label: t("common:DISABLED"), variant: "error" };
    }
    if (
      item.expiredReason === "UsageLimitExceeded" ||
      (item.usageLimit > 0 && item.usageCount >= item.usageLimit)
    ) {
      return { label: t("MAGIC_URL_STATUS_BADGE.LIMIT_EXCEEDED"), variant: "error" };
    }
    if (item.expiredReason === "TimeExpired" || (expiryDate && expiryDate < now)) {
      return { label: t("MAGIC_URL_STATUS_BADGE.EXPIRED"), variant: "error" };
    }
    if (item.isExpired) {
      return { label: t("MAGIC_URL_STATUS_BADGE.EXPIRED"), variant: "error" };
    }
    return { label: t("MAGIC_URL_STATUS_BADGE.ACTIVE"), variant: "success" };
  };
  const { label, variant } = getStatus(item);
  return (
    <Badge variant={variant as never} className="whitespace-nowrap rounded-full">
      {label}
    </Badge>
  );
}
