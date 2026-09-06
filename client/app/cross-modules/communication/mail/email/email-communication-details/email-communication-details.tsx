import React, { useState } from "react";
import { ArrowLeft, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import EditCommunication from "@blocks-communication/mail/components/email-service/modals/edit-communication/edit-communication";
import { checkValidDate, formatFullDate, parseDateString } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useUserStore } from "@seliseblocks/genesis-os/store";
import { useGetEmailConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import { langConfigureData } from "@blocks-localization/constants/language-dummy-data";
import {
  useGetEmailTemplate,
  useSendTestMail,
} from "@blocks-communication/mail/hooks/use-email-template";
import { EmailTemplateDetailsSkeleton } from "./email-template-details-skeleton";
export function EmailCommunicationDetails({
  params,
  onBack,
}: {
  params: { id: string };
  onBack?: () => void;
}) {
  const { id } = params;
  const { isLoading, isFetching, data } = useGetEmailTemplate(id);
  const { userDetails } = useUserStore();
  const [emailDetails, setEmailDetails] = useState<IEmailTemplate | null>(null);
  const {
    isLoading: isConfigsLoading,
    isFetching: isConfigsFetching,
    data: emailConfigsData,
  } = useGetEmailConfigs(0, 100);
  const { isPending, mutateAsync } = useSendTestMail();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSendTestEmailModalOpen, setIsSendTestEmailModalOpen] = useState(false);
  const sendTestEmailModalOpen = () => {
    setIsSendTestEmailModalOpen(true);
  };
  const [prevSync, setPrevSync] = useState<{ id: typeof id; data: typeof data } | undefined>(
    undefined,
  );
  if (!prevSync || prevSync.id !== id || prevSync.data !== data) {
    setPrevSync({ id, data });
    if (id) {
      setEmailDetails(data || null);
    }
  }
  if (!emailDetails || isLoading || isFetching || isConfigsLoading || isConfigsFetching) {
    return <EmailTemplateDetailsSkeleton />;
  }
  const emailBasePath = scoped("email-management");
  const breadcrumbTitles = {
    [emailBasePath]: "Email Management",
    [`${emailBasePath}/communications`]: null,
    [`${emailBasePath}/communications/${emailDetails.itemId}`]: emailDetails.name ?? "",
  };
  const confirmationModalData = {
    dialogTitle: "Send test email",
    dialogSubtitle: "Are you sure you want to send a test email?",
    confirmButton: "Send",
    cancelButton: "Cancel",
  };
  const dat: IEmailTemplate = {
    itemId: "",
    createdDate: "",
    lastUpdatedDate: "",
    createdBy: "",
    lastUpdatedBy: "",
    organizationIds: [],
    tags: [],
    mailConfigurationId: "",
    templateBody: "",
    jsonContent: "",
    imageId: "",
    imageUrl: "",
    language: "",
    name: "",
    templateSubject: "",
    generatedBy: "",
  };
  const editData = emailDetails ? emailDetails : dat;
  const sendTestEmail = async () => {
    try {
      const payload = {
        to: userDetails?.email || "",
        purpose: emailDetails.name || "",
        language: emailDetails.language || "",
      };
      const res = await mutateAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Sent test email successfully",
        });
        setIsSendTestEmailModalOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
        setIsSendTestEmailModalOpen(false);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
      setIsSendTestEmailModalOpen(false);
    }
  };
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="mt-5 h-8 w-8 shrink-0 md:hidden"
            onClick={() => (onBack ? onBack() : navigate(-1))}
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="min-w-0">
            <PageBreadcrumb
              breadcrumbIndex={3}
              className="flex min-w-0"
              customTitles={breadcrumbTitles}
            />
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-high-emphasis sm:text-2xl">
              {emailDetails.name}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 justify-end sm:self-end">
          <Button
            size="default"
            variant="outline"
            className="gap-2 shadow-none hover:bg-white"
            disabled={isPending}
            onClick={sendTestEmailModalOpen}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Send test Email</span>
          </Button>
          <Dialog open={isSendTestEmailModalOpen} onOpenChange={setIsSendTestEmailModalOpen}>
            <ConfirmationModal
              onCancel={() => {
                setIsSendTestEmailModalOpen(false);
              }}
              onConfirm={sendTestEmail}
              data={confirmationModalData}
              buttonState={{ confirm: { disable: isPending } }}
            />
          </Dialog>
        </div>
      </div>
      <div className="grid min-h-[34rem] min-w-0 flex-none grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.8fr)] overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:min-h-[38rem] sm:grid-cols-[minmax(0,2fr)_minmax(16rem,0.9fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,0.9fr)]">
        <section className="flex min-h-[34rem] min-w-0 flex-col border-r border-border sm:min-h-[38rem] xl:min-h-0">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-high-emphasis">
              Template preview
            </h2>
            <Button
              size="default"
              variant="outline"
              className="shrink-0 gap-2 shadow-none"
              onClick={() =>
                navigate(scoped(`email-management/communications/${emailDetails.itemId}/edit`))
              }
            >
              <Pencil className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
            </Button>
          </header>
          <div className="min-h-0 flex-1 bg-muted/30">
            <iframe
              title={`${emailDetails.name || "Email template"} preview`}
              srcDoc={emailDetails.templateBody}
              className="h-full min-h-[30rem] w-full border-0 bg-white sm:min-h-[34rem] xl:min-h-0"
            />
          </div>
        </section>
        <aside className="flex min-w-0 flex-col">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-high-emphasis">Details</h2>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="default"
                  variant="outline"
                  className="shrink-0 gap-2 shadow-none"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Pencil className="h-5 w-5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
                </Button>
              </DialogTrigger>
              <EditCommunication
                dialogTitle="Edit Template"
                templateData={editData}
                onClose={() => {
                  setIsEditDialogOpen(false);
                }}
              />
            </Dialog>
          </header>
          <div className="grid gap-x-6 gap-y-7 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="grid min-w-0 gap-1 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              <h3 className="text-sm font-medium text-low-emphasis">Subject</h3>
              <p className="break-words text-base font-medium text-high-emphasis">
                {emailDetails.templateSubject || "-"}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">Language</h3>
              <p className="break-words text-base font-medium text-high-emphasis">
                {langConfigureData.find(
                  (lang) =>
                    lang.itemId.split("-")[0] === (emailDetails.language ?? "").split("-")[0],
                )?.languageName || "-"}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">Configuration</h3>
              <p className="break-words text-base font-medium text-high-emphasis">
                {emailConfigsData?.find(
                  (config) => config.itemId === emailDetails.mailConfigurationId,
                )?.name || "-"}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
              <p className="break-words text-base font-medium text-high-emphasis">
                {!emailDetails.createdDate || !checkValidDate(emailDetails.createdDate)
                  ? "-"
                  : formatFullDate(parseDateString(emailDetails.createdDate))}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">Last modified</h3>
              <p className="break-words text-base font-medium text-high-emphasis">
                {!emailDetails.lastUpdatedDate || !checkValidDate(emailDetails.lastUpdatedDate)
                  ? "-"
                  : formatFullDate(parseDateString(emailDetails.lastUpdatedDate))}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
