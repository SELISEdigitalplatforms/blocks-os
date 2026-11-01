import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { IMessagingServiceData } from "@blocks-communication/mail/models/messaging";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import CampaignCreation from "@blocks-communication/mail/components/messaging/campaign-creation/campaign-creation";
import { formatDate } from "@/lib/utils";
import { messagingServiceData } from "@blocks-communication/mail/constants/messaging";
import { useT } from "@seliseblocks/genesis-os";
export function CampaignDetails({ params }: { params: { id: string } }) {
  const { t } = useT("os.communication.mail");
  const { id } = params;
  const [messageDetails, setMessageDetails] = useState<IMessagingServiceData | null>(null);
  const [prevId, setPrevId] = useState<typeof id | undefined>(undefined);
  if (prevId !== id) {
    setPrevId(id);
    if (id) {
      const messageId = Array.isArray(id) ? id[0] : id;
      const message = messagingServiceData.find((item) => item.id === messageId);
      setMessageDetails(message || null);
    }
  }
  if (!messageDetails) {
    return <div>{t("common:LOADING")}</div>;
  }
  const breadcrumbTitles = {
    "/utilities/messaging/campaigns": t("CAMPAIGN_DETAILS.BREADCRUMB_MESSAGING_MESSAGES"),
    ["/utilities/messaging/campaigns/" + messageDetails?.id]: messageDetails.name,
  };
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={3} customTitles={breadcrumbTitles} />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{messageDetails.name}</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 gap-2 px-4 py-1 shadow-none">
              <Pencil className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">{t("CAMPAIGN_DETAILS.EDIT_MESSAGES")}</span>
            </Button>
          </DialogTrigger>
          <CampaignCreation dialogTitle={t("CAMPAIGN_DETAILS.EDIT_MESSAGES")} />
        </Dialog>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          className="rounded-sm shadow-none lg:col-span-2"
          style={{ minHeight: 0, height: "auto" }}
        >
          <CardHeader>
            <CardTitle className="text-xl">{t("CAMPAIGN_DETAILS.MESSAGE")}</CardTitle>
          </CardHeader>
          <CardContent className="text-base">
            {t("CAMPAIGN_DETAILS.MESSAGE_BODY")}
          </CardContent>
        </Card>
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">{t("CAMPAIGN_DETAILS.ABOUT")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="grid gap-10">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">{t("CAMPAIGN_DETAILS.CONFIGURATION")}</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {messageDetails.configuration}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">{t("CAMPAIGN_DETAILS.CREATED_ON")}</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {formatDate(messageDetails.createdOn, true)}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">{t("CAMPAIGN_DETAILS.LAST_MODIFIED")}</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {formatDate(messageDetails.lastModified)}
                </p>
              </div>
            </div>
            <div>
              <div className="grid gap-10">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">{t("CAMPAIGN_DETAILS.PROTOCOL")}</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {messageDetails.protocol}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">{t("CAMPAIGN_DETAILS.CREATED_BY")}</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {messageDetails.createdBy}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
