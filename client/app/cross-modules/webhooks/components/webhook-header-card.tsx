import type { ReactNode } from "react";
import { Loader2, MoreHorizontal, Pencil, Power, Send, Trash2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { cn } from "@/lib/utils";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhook } from "../models/webhook.model";
import { formatDateTime } from "../utils/format";
import { WebhookStatusBadges } from "./webhook-status-badges";

const FACT_LABEL = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const FACT_VALUE = "mt-1.5 text-sm font-medium text-high-emphasis";
// Stands in for {{reason}} while translating, so the reason can be rendered as <code>
// wherever the sentence puts it.
const REASON_SLOT = "\u0000reason\u0000";

interface WebhookHeaderCardProps {
  webhook: IWebhook;
  isTesting: boolean;
  isSaving: boolean;
  onTest: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function Fact({
  label,
  first,
  children,
}: Readonly<{ label: string; first?: boolean; children: ReactNode }>) {
  return (
    <div className={cn("px-5 py-4 sm:px-6", !first && "border-t md:border-l md:border-t-0")}>
      <p className={FACT_LABEL}>{label}</p>
      <div className={FACT_VALUE}>{children}</div>
    </div>
  );
}

function AutoOffReason({ reason }: Readonly<{ reason: string }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const [before, after] = t("DETAILS.AUTO_OFF_BODY", { reason: REASON_SLOT }).split(REASON_SLOT);
  return (
    <>
      {before}
      <code>{reason}</code>
      {after}
    </>
  );
}

/** Name, status, endpoint, actions and key facts of a webhook, in one card. */
export function WebhookHeaderCard({
  webhook,
  isTesting,
  isSaving,
  onTest,
  onEdit,
  onToggleActive,
  onDelete,
}: Readonly<WebhookHeaderCardProps>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const isFailing = webhook.consecutiveFailures > 0;
  const secretText = webhook.secretSet
    ? t("DETAILS.SECRET_SET", { date: formatDateTime(webhook.secretChangedDate) })
    : t("DETAILS.SECRET_NOT_SET");

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight text-high-emphasis sm:text-2xl">
              {webhook.name}
            </h1>
            <WebhookStatusBadges webhook={webhook} />
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded-sm bg-muted px-1.5 font-mono text-xs font-semibold text-medium-emphasis">
              {t("DETAILS.METHOD_POST")}
            </span>
            <span className="truncate font-mono text-sm text-medium-emphasis" title={webhook.url}>
              {webhook.url}
            </span>
            <CopyToClipboardButton textToCopy={webhook.url} label={t("DETAILS.COPY_URL")}>
              {null}
            </CopyToClipboardButton>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={isTesting} onClick={onTest}>
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            <span>{t("DETAILS.SEND_TEST")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{t("common:EDIT")}</span>
          </Button>
          {webhook.isActive ? null : (
            <Button variant="outline" size="sm" disabled={isSaving} onClick={onToggleActive}>
              <Power className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>{t("DETAILS.TURN_ON")}</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label={t("DETAILS.MORE_ACTIONS")}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {webhook.isActive ? (
                <>
                  <DropdownMenuItem disabled={isSaving} onSelect={onToggleActive}>
                    <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>{t("DETAILS.TURN_OFF")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem className="text-error focus:text-error" onSelect={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>{t("DETAILS.DELETE_WEBHOOK")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {webhook.disabledReason ? (
        <Banner
          variant="warning"
          compact={false}
          className="mx-5 mb-5 sm:mx-6"
          title={t("DETAILS.AUTO_OFF_TITLE")}
        >
          <AutoOffReason reason={webhook.disabledReason} />
        </Banner>
      ) : null}

      <div className="grid grid-cols-1 border-t md:grid-cols-3">
        <Fact label={t("DETAILS.SIGNING_SECRET")} first>
          {secretText}
        </Fact>
        <Fact label={t("DETAILS.CREATED")}>{formatDateTime(webhook.createdDate)}</Fact>
        <Fact label={t("DETAILS.FAILURES")}>
          <span className={cn("tabular-nums", isFailing && "text-error")}>
            {webhook.consecutiveFailures}
          </span>
        </Fact>
      </div>
    </Card>
  );
}
