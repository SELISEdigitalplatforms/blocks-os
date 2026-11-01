import React, { useState } from "react";
import { Pencil, Trash, Mail } from "lucide-react";
import DeleteEmailConfig from "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config";
import NewConfiguration from "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration";
import EditDefaultSenderName from "@blocks-communication/mail/components/email-service/modals/edit-default-sender-name/edit-default-sender-name";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { useMediaQuery } from "@/components/ui-kits/stepper/use-media-query";
import { cn } from "@/lib/utils";
import {
  getMailProviderLabel,
  IEmailConfig,
  usesPasswordAuthentication,
} from "@blocks-communication/mail/models/email";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useT } from "@seliseblocks/genesis-os";
import { LinkedSecretStatusValue } from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";
interface EmailConfigurationProps {
  addConfigOpen?: boolean;
  onAddConfigOpenChange?: (open: boolean) => void;
}
export function EmailConfiguration({
  addConfigOpen,
  onAddConfigOpenChange,
}: EmailConfigurationProps = {}) {
  const { t } = useT("os.communication.mail");
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = addConfigOpen !== undefined ? addConfigOpen : internalOpen;
  const setOpen = onAddConfigOpenChange || setInternalOpen;
  // The id of the one row whose dialog is open. Every row renders its own dialog, so a shared
  // boolean opened all of them at once — and the last row's dialog, on top, was the one acted on.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isMediumScreen = useMediaQuery(`(max-width: 1180px)`);
  const isMobileScreen = useMediaQuery(`(max-width: 768px)`);
  const { isLoading, data: secretData } = useGetEmailSecretConfigs();
  const data = secretData?.configurations || [];
  if (isLoading) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }
  // if (error) {
  //   return (
  //     <div className="p-4">
  //       <div className="rounded border border-red-200 bg-red-50 p-4">
  //         <h2 className="font-medium text-red-800">Error</h2>
  //         <p className="text-red-600">{error}</p>
  //       </div>
  //     </div>
  //   );
  // }
  return (
    <div>
      {/* The form lives only while its dialog is open, so Cancel drops unsaved
          input and the next open starts from the stored record. */}
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <NewConfiguration
            dialogTitle={t("EMAIL_CONFIGURE.ADD_CONFIGURATION")}
            onClose={() => setOpen(false)}
            isEdit={false}
          />
        )}
      </Dialog>
      {data && data.length > 0 ? (
        <Accordion type="single" collapsible className="mt-6" defaultValue={data[0].itemId}>
          {data.map((config: IEmailConfig, index: number) => (
            <AccordionItem
              key={config.itemId}
              value={config.itemId}
              className={`rounded-sm border bg-background px-4 ${index > 0 ? "mt-6" : ""}`}
            >
              <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                <div className="flex items-center justify-between w-full pr-8">
                  <span>{config.name}</span>
                  <div className="flex gap-1">
                    {/* The default record is editable only in its sender name, which an
                        inbound record does not have. */}
                    {(!config.isDefault || !config.isInbound) && (
                      <Dialog
                        open={editingId === config.itemId}
                        onOpenChange={(isOpen) => setEditingId(isOpen ? config.itemId : null)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t("common:EDIT")}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>{t("common:EDIT")}</TooltipContent>
                        </Tooltip>
                        {editingId === config.itemId && config.isDefault && (
                          <EditDefaultSenderName
                            config={config}
                            onClose={() => setEditingId(null)}
                          />
                        )}
                        {editingId === config.itemId && !config.isDefault && (
                          <NewConfiguration
                            dialogTitle={t("EMAIL_CONFIGURE.EDIT_CONFIGURATION")}
                            previousData={config}
                            isEdit={true}
                            onClose={() => setEditingId(null)}
                          />
                        )}
                      </Dialog>
                    )}
                    {!config.isDefault && (
                      <Dialog
                        open={deletingId === config.itemId}
                        onOpenChange={(isOpen) => setDeletingId(isOpen ? config.itemId : null)}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t("common:DELETE")}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>{t("common:DELETE")}</TooltipContent>
                        </Tooltip>
                        <DeleteEmailConfig
                          configId={config.itemId}
                          onClose={() => setDeletingId(null)}
                        />
                      </Dialog>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div
                  className={cn(
                    "mt-5 grid grid-cols-3 space-y-2",
                    isMediumScreen && "gap-12",
                    isMobileScreen && "grid-cols-1 gap-6",
                  )}
                >
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {config.isInbound
                        ? t("EMAIL_CONFIGURE.SERVER_NAME")
                        : t("EMAIL_CONFIGURE.HOST")}
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
                        {config.isInbound
                          ? t("EMAIL_CONFIGURE.INBOUND")
                          : t("EMAIL_CONFIGURE.OUTBOUND")}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-5 grid grid-cols-3 space-y-2",
                    isMediumScreen && "gap-12",
                    isMobileScreen && "grid-cols-1 gap-6",
                  )}
                >
                  {!config.isInbound && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {t("EMAIL_CONFIGURE.SENDER_NAME")}
                        </p>
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
                {/* Credentials follow the authentication type in both directions: an Office 365
                    inbound record signs in with OAuth and has no username or password to show. */}
                {usesPasswordAuthentication(
                  config.provider,
                  config.isInbound,
                  config.authenticationType,
                ) ? (
                  <div
                    className={cn(
                      "mt-5 grid grid-cols-3 space-y-2",
                      isMediumScreen && "gap-12",
                      isMobileScreen && "grid-cols-1 gap-6",
                    )}
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {config.isInbound
                          ? t("EMAIL_CONFIGURE.USERNAME")
                          : t("EMAIL_CONFIGURE.SENDER_USERNAME")}
                      </p>
                      <p className="text-base">{config.senderUserName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("EMAIL_CONFIGURE.ACCOUNT_PASSWORD")}
                      </p>
                      <p className="trucate break-all text-base">*********************</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "mt-5 grid grid-cols-3 space-y-2",
                      isMediumScreen && "gap-12",
                      isMobileScreen && "grid-cols-1 gap-6",
                    )}
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("EMAIL_CONFIGURE.TENANT_ID")}
                      </p>
                      <p className="trucate break-all text-base">{config.tenantId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("EMAIL_CONFIGURE.CLIENT_ID")}
                      </p>
                      <p className="trucate break-all text-base">{config.clientId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("EMAIL_CONFIGURE.MAILBOX_ADDRESS")}
                      </p>
                      <p className="trucate break-all text-base">{config.mailboxAddress}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("EMAIL_CONFIGURE.CLIENT_SECRET")}
                      </p>
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
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <EmptyState
          icon={Mail}
          title={t("EMAIL_CONFIGURE.EMPTY_TITLE")}
          description={t("EMAIL_CONFIGURE.EMPTY_DESCRIPTION")}
        />
      )}
    </div>
  );
}

export function EmailConfigurationPage() {
  const [addOpen, setAddOpen] = useQueryState("emailConfig", parseAsBoolean.withDefault(false));
  return <EmailConfiguration addConfigOpen={addOpen} onAddConfigOpenChange={setAddOpen} />;
}
