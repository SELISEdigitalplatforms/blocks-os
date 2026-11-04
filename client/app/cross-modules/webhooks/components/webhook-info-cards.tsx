import type { ReactNode } from "react";
import { useT } from "@seliseblocks/genesis-os";
import { Badge } from "@/components/ui-kits/badge/badge";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhook } from "../models/webhook.model";
import { formatDateTime } from "../utils/format";

function InfoCard({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm text-high-emphasis">{children}</div>
    </div>
  );
}

export function WebhookInfoCards({ webhook }: Readonly<{ webhook: IWebhook }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const secretText = webhook.secretSet
    ? t("DETAILS.SECRET_SET", { date: formatDateTime(webhook.secretChangedDate) })
    : t("DETAILS.SECRET_NOT_SET");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <InfoCard title={t("DETAILS.STATUS")}>
        <Badge variant={webhook.isActive ? "success" : "secondary"} className="w-fit">
          {webhook.isActive ? t("LIST.ACTIVE") : t("LIST.OFF")}
        </Badge>
        {webhook.disabledReason && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("DETAILS.TURNED_OFF_BECAUSE")} <code>{webhook.disabledReason}</code>
          </p>
        )}
      </InfoCard>
      <InfoCard title={t("DETAILS.SECRET")}>{secretText}</InfoCard>
      <InfoCard title={t("DETAILS.CREATED")}>
        {formatDateTime(webhook.createdDate)}
        {webhook.createdBy && (
          <span className="text-muted-foreground">
            {" "}
            {t("DETAILS.BY")} {webhook.createdBy}
          </span>
        )}
      </InfoCard>
      <InfoCard title={t("DETAILS.FAILURES")}>
        {t("DETAILS.FAILURES_IN_A_ROW", { count: webhook.consecutiveFailures })}
      </InfoCard>
    </div>
  );
}
