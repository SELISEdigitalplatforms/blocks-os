import React from "react";
import { Copy, Pencil, Plus, Trash } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui-kits/accordion/accordion";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import DeleteEmailConfig from "@blocks-communication/mail/components/email-service/modals/delete-email-config/delete-email-config";
import MessageConfiguration from "@blocks-communication/mail/components/messaging/message-configuration/message-configuration";
import { useT } from "@seliseblocks/genesis-os";
interface MessagingConfig {
  id: string;
  title: string;
  protocol: string;
  serviceVendor: string;
  authenticationToken: string;
  accountID: string;
  sender: string;
  numberLookupEndURI: string;
}
const msgConfigurations: MessagingConfig[] = [
  {
    id: "default",
    title: "Default",
    protocol: "SMS",
    serviceVendor: "Vendor Name",
    authenticationToken: "e728423xae0njf5502",
    accountID: "22718945",
    sender: "Jordyn Workman",
    numberLookupEndURI: "EE85JKL",
  },
  {
    id: "custome1",
    title: "Custom Configuration 1",
    protocol: "SMS",
    serviceVendor: "Vendor Name",
    authenticationToken: "e728423xae0njf5502",
    accountID: "22718945",
    sender: "Jordyn Workman",
    numberLookupEndURI: "EE85JKL",
  },
  {
    id: "custome2",
    title: "Custom Configuration 2",
    protocol: "SMS",
    serviceVendor: "Vendor Name",
    authenticationToken: "e728423xae0njf5502",
    accountID: "22718945",
    sender: "Jordyn Workman",
    numberLookupEndURI: "EE85JKL",
  },
];
export function MessagingConfiguration() {
  const { t } = useT("os.communication.mail");
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("MESSAGING_CONFIGURE.TITLE")}</h1>
        <div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10 gap-2 px-4 py-1">
                <Plus className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t("MESSAGING_CONFIGURE.NEW_CONFIGURATION")}
                </span>
              </Button>
            </DialogTrigger>
            <MessageConfiguration dialogTitle={t("MESSAGING_CONFIGURE.NEW_CONFIGURATION")} data={[]} />
          </Dialog>
        </div>
      </div>
      <Accordion type="single" collapsible className="mt-6" defaultValue={msgConfigurations[0]?.id}>
        {msgConfigurations.map((config, index) => (
          <AccordionItem
            key={config.id}
            value={config.id}
            className={`rounded-sm border bg-background px-4 ${index > 0 ? "mt-6" : ""}`}
          >
            <AccordionTrigger className="text-xl font-semibold">{config.title}</AccordionTrigger>
            <AccordionContent>
              {config.id !== "default" && (
                <div className="flex gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 gap-2 px-4 py-1 text-red-500 hover:bg-red-400 hover:text-white"
                      >
                        <Trash className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                          {t("common:DELETE")}
                        </span>
                      </Button>
                    </DialogTrigger>
                    <DeleteEmailConfig onClose={() => {}} configId={config.id} />
                  </Dialog>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-9 gap-2 px-4 py-1">
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                          {t("common:EDIT")}
                        </span>
                      </Button>
                    </DialogTrigger>
                    <MessageConfiguration dialogTitle={t("MESSAGING_CONFIGURE.EDIT_CONFIGURATION")} data={[]} />
                  </Dialog>
                  <Button size="sm" variant="outline" className="h-9 gap-2 px-4 py-1">
                    <Copy className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      {t("MESSAGING_CONFIGURE.DUPLICATE")}
                    </span>
                  </Button>
                </div>
              )}
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.PROTOCOL")}</p>
                  <p className="text-base">{config.protocol}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.SERVICE_VENDOR")}</p>
                  <p className="text-base">{config.serviceVendor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.AUTHENTICATION_TOKEN")}</p>
                  <p className="text-base">{config.authenticationToken}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.ACCOUNT_ID")}</p>
                  <p className="text-base">{config.accountID}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.SENDER")}</p>
                  <p className="text-base">{config.sender}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("MESSAGING_CONFIGURE.NUMBER_LOOKUP_END_URI")}</p>
                  <p className="text-base">{config.numberLookupEndURI}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
