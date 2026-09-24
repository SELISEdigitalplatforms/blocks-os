import React, { useState } from "react";
import { Pencil, Trash, Mail } from "lucide-react";
import DeleteEmailConfig from "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config";
import NewConfiguration from "@blocks-communication/mail/components/email-service/modals/new-configuration/new-configuration";
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
interface EmailConfigurationProps {
  addConfigOpen?: boolean;
  onAddConfigOpenChange?: (open: boolean) => void;
}
export function EmailConfiguration({
  addConfigOpen,
  onAddConfigOpenChange,
}: EmailConfigurationProps = {}) {
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
      <Dialog open={open} onOpenChange={setOpen}>
        <NewConfiguration
          dialogTitle="Add Configuration"
          onClose={() => setOpen(false)}
          isEdit={false}
        />
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
                    {!config.isDefault && (
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
                                aria-label="Edit"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                        <NewConfiguration
                          dialogTitle="Edit Configuration"
                          previousData={config}
                          isEdit={true}
                          onClose={() => setEditingId(null)}
                        />
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
                                aria-label="Delete"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Delete</TooltipContent>
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
                      {config.isInbound ? "Server Name" : "Host"}
                    </p>
                    <p className="text-base">{config.host}</p>
                  </div>
                  <div className="ml-1">
                    <p className="text-sm text-muted-foreground">Port</p>
                    <p className="text-base">{config.port}</p>
                  </div>
                  <div>
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="text-base">{config.isInbound ? "Inbound" : "Outbound"}</p>
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
                        <p className="text-sm text-muted-foreground">Sender name</p>
                        <p className="text-base">{config.senderName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Sender address</p>
                        <p className="text-base">{config.senderAddress}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
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
                        {config.isInbound ? "Username" : "Sender username"}
                      </p>
                      <p className="text-base">{config.senderUserName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Password</p>
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
                      <p className="text-sm text-muted-foreground">Tenant ID</p>
                      <p className="trucate break-all text-base">{config.tenantId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client ID</p>
                      <p className="trucate break-all text-base">{config.clientId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mailbox Address</p>
                      <p className="trucate break-all text-base">{config.mailboxAddress}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client secret</p>
                      <p className="text-base">
                        {config.isClientSecretConfigured ? "Configured" : "Not configured"}
                      </p>
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
          title="No email configurations found"
          description="Use the Add Configuration button above to create one."
        />
      )}
    </div>
  );
}

export function EmailConfigurationPage() {
  const [addOpen, setAddOpen] = useQueryState("emailConfig", parseAsBoolean.withDefault(false));
  return <EmailConfiguration addConfigOpen={addOpen} onAddConfigOpenChange={setAddOpen} />;
}
