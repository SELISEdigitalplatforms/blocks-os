import React from "react";
import { EllipsisVertical, Pencil, Trash } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useMediaQuery } from "@/components/ui-kits/stepper/use-media-query";
import { cn } from "@/lib/utils";
import { LinkedSecretStatusValue } from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";
import {
  getMailProviderLabel,
  IEmailConfig,
  usesPasswordAuthentication,
} from "@blocks-communication/mail/models/email";
import { useGetEmailConfigUsage } from "@blocks-communication/mail/hooks/use-email-config";

// Credentials follow the authentication type in both directions: an Office 365
// inbound record signs in with OAuth and has no username or password to show.
function ConfigCredentials({
  config,
  gridClassName,
}: Readonly<{ config: IEmailConfig; gridClassName: string }>) {
  const { t } = useT("os.communication.mail");
  if (usesPasswordAuthentication(config.provider, config.isInbound, config.authenticationType)) {
    return (
      <div className={gridClassName}>
        <div>
          <p className="text-sm text-muted-foreground">
            {config.isInbound
              ? t("EMAIL_CONFIGURE.USERNAME")
              : t("EMAIL_CONFIGURE.SENDER_USERNAME")}
          </p>
          <p className="text-base">{config.senderUserName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.ACCOUNT_PASSWORD")}</p>
          <p className="trucate break-all text-base">*********************</p>
        </div>
      </div>
    );
  }
  return (
    <div className={gridClassName}>
      <div>
        <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.TENANT_ID")}</p>
        <p className="trucate break-all text-base">{config.tenantId}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.CLIENT_ID")}</p>
        <p className="trucate break-all text-base">{config.clientId}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.MAILBOX_ADDRESS")}</p>
        <p className="trucate break-all text-base">{config.mailboxAddress}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.CLIENT_SECRET")}</p>
        <LinkedSecretStatusValue
          status={config.clientSecretStatus}
          fallback={
            <p className="text-base">
              {config.isClientSecretConfigured
                ? t("EMAIL_CONFIGURE.CONFIGURED")
                : t("EMAIL_CONFIGURE.NOT_CONFIGURED")}
            </p>
          }
        />
      </div>
    </div>
  );
}

/**
 * "Used by N templates". It renders only inside the expanded content, which mounts only while the
 * card is open, so the count is fetched for the open card and never for the rest.
 */
function ConfigUsage({ configurationId }: Readonly<{ configurationId: string }>) {
  const { t } = useT("os.communication.mail");
  const { data, isLoading, isError, refetch } = useGetEmailConfigUsage(configurationId);
  return (
    <div>
      <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.USAGE")}</p>
      {isLoading && <Skeleton className="mt-1 h-5 w-32 rounded" />}
      {isError && (
        <p className="text-base">
          {t("EMAIL_CONFIGURE.USAGE_UNAVAILABLE")}{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-base"
            onClick={() => void refetch()}
          >
            {t("EMAIL_CONFIGURE.RETRY")}
          </Button>
        </p>
      )}
      {!isLoading && !isError && typeof data === "number" && (
        <p className="text-base">{t("EMAIL_CONFIGURE.USED_BY_TEMPLATES", { count: data })}</p>
      )}
    </div>
  );
}

interface EmailConfigCardProps {
  config: IEmailConfig;
  isFirst: boolean;
  /** Multi-org projects mark organization and project defaults and show the organization. */
  showOrganization: boolean;
  /** The card's organization name; shown only with {@link showOrganization}. */
  organizationName?: string;
  onEdit: () => void;
  onDelete: () => void;
  /** The open edit and delete dialogs, rendered next to the card rather than inside its header. */
  children?: React.ReactNode;
}

/** One configuration: header with chips and the ⋮ menu, details when expanded. */
export function EmailConfigCard({
  config,
  isFirst,
  showOrganization,
  organizationName,
  onEdit,
  onDelete,
  children,
}: Readonly<EmailConfigCardProps>) {
  const { t } = useT("os.communication.mail");
  const isMediumScreen = useMediaQuery(`(max-width: 1180px)`);
  const isMobileScreen = useMediaQuery(`(max-width: 768px)`);
  const gridClassName = cn(
    "mt-5 grid grid-cols-3 space-y-2",
    isMediumScreen && "gap-12",
    isMobileScreen && "grid-cols-1 gap-6",
  );
  // The default record is editable only in its sender name, which an inbound record does not
  // have; it is never deletable.
  const canEdit = !config.isDefault || !config.isInbound;
  const canDelete = !config.isDefault;

  return (
    <AccordionItem
      value={config.itemId}
      className={cn("rounded-sm border bg-background px-4", !isFirst && "mt-6")}
    >
      {/* The menu sits beside the trigger, not inside it: a button inside the accordion's button
          is invalid, and would fold "More actions for …" into the card's own accessible name. */}
      <div className="relative">
        <AccordionTrigger className="text-xl font-semibold hover:no-underline">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 pr-14 text-left">
            <span className="break-words">{config.name}</span>
            {showOrganization && config.isOrganizationDefault && (
              <Badge variant="info">{t("EMAIL_CONFIGURE.ORG_DEFAULT")}</Badge>
            )}
            {showOrganization && config.isDefault && (
              <Badge variant="secondary">{t("EMAIL_CONFIGURE.PROJECT_DEFAULT")}</Badge>
            )}
          </div>
        </AccordionTrigger>
        {(canEdit || canDelete) && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("EMAIL_CONFIGURE.MORE_ACTIONS", { name: config.name })}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem className="gap-2" onSelect={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t("common:EDIT")}</span>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem className="gap-2 text-destructive" onSelect={onDelete}>
                    <Trash className="h-3.5 w-3.5" />
                    <span>{t("common:DELETE")}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {children}
      <AccordionContent>
        <div className={gridClassName}>
          <div>
            <p className="text-sm text-muted-foreground">
              {config.isInbound ? t("EMAIL_CONFIGURE.SERVER_NAME") : t("EMAIL_CONFIGURE.HOST")}
            </p>
            <p className="text-base">{config.host}</p>
          </div>
          <div className="ml-1">
            <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.PORT")}</p>
            <p className="text-base">{config.port}</p>
          </div>
          <div>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">{t("common:TYPE")}</p>
              <p className="text-base">
                {config.isInbound ? t("EMAIL_CONFIGURE.INBOUND") : t("EMAIL_CONFIGURE.OUTBOUND")}
              </p>
            </div>
          </div>
        </div>
        <div className={gridClassName}>
          {!config.isInbound && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.SENDER_NAME")}</p>
                <p className="text-base">{config.senderName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("EMAIL_CONFIGURE.SENDER_ADDRESS")}
                </p>
                <p className="text-base">{config.senderAddress}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.PROVIDER")}</p>
            <p className="text-base">{getMailProviderLabel(config.provider)}</p>
          </div>
        </div>
        <ConfigCredentials config={config} gridClassName={gridClassName} />
        <div className={gridClassName}>
          {showOrganization && (
            <div>
              <p className="text-sm text-muted-foreground">{t("EMAIL_CONFIGURE.ORGANIZATION")}</p>
              <p className="text-base">{organizationName}</p>
            </div>
          )}
          <ConfigUsage configurationId={config.itemId} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
