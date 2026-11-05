import React, { useState } from "react";
import { ArrowLeft, Copy, CopyPlus, EllipsisVertical, Pencil, Send, Trash } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import EditCommunication from "@blocks-communication/mail/components/email-service/modals/edit-communication/edit-communication";
import { checkValidDate, formatFullDate, parseDateString } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useT } from "@seliseblocks/genesis-os";
import { useUserStore } from "@seliseblocks/genesis-os/store";
import { useGetEmailSecretConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import {
  EMAIL_ORGANIZATION_PARAM,
  useEmailOrganization,
  useOrganizationName,
} from "@blocks-communication/mail/hooks/use-email-organization";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import { useGetEmailTemplate } from "@blocks-communication/mail/hooks/use-email-template";
import {
  DEFAULT_ORGANIZATION_ID,
  organizationOf,
} from "@blocks-communication/mail/constants/organization";
import {
  languageNameOf,
  resolveOrganizationDefault,
} from "@blocks-communication/mail/constants/template-organization";
import { TemplateConfigurationName } from "@blocks-communication/mail/email/email-service-table/template-configuration-name";
import { CloneTemplateDialog } from "@blocks-communication/mail/components/email-service/modals/clone-template/clone-template";
import { DeleteTemplateDialog } from "@blocks-communication/mail/components/email-service/modals/delete-template/delete-template";
import { SendTestEmailDialog } from "@blocks-communication/mail/components/email-service/modals/send-test-email/send-test-email";
import { CopyToOrganizationsDialog } from "@blocks-communication/mail/components/email-service/modals/copy-to-organizations/copy-to-organizations";
import { EmailTemplateDetailsSkeleton } from "./email-template-details-skeleton";
import { withStyleNonce } from "@/lib/csp-nonce";
export function EmailCommunicationDetails({
  params,
  onBack,
}: {
  params: { id: string };
  onBack?: () => void;
}) {
  const { t } = useT("os.communication.mail");
  const { id } = params;
  const { isLoading, isFetching, data } = useGetEmailTemplate(id);
  const { userDetails } = useUserStore();
  const [emailDetails, setEmailDetails] = useState<IEmailTemplate | null>(null);
  // The template's organization's configurations and the Default organization's, for the
  // Configuration field and what a test mail sends through.
  const organizationId = organizationOf(data ?? {});
  const {
    isLoading: isConfigsLoading,
    isFetching: isConfigsFetching,
    data: configsResponse,
  } = useGetEmailSecretConfigs(organizationId);
  const emailConfigsData = configsResponse?.configurations ?? [];
  const { isMultiOrgEnabled } = useEmailOrganization();
  const organizationName = useOrganizationName(organizationId);
  const { data: languageListData } = useGetLanguages();
  const languages = Array.isArray(languageListData) ? languageListData : [];
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
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
    [emailBasePath]: t("EMAIL_COMMUNICATION_DETAILS.BREADCRUMB_EMAIL_MANAGEMENT"),
    [`${emailBasePath}/communications`]: null,
    [`${emailBasePath}/communications/${emailDetails.itemId}`]: emailDetails.name ?? "",
  };
  const editData = emailDetails;
  const languageName = languageNameOf(emailDetails.language, languages);
  const sendsThrough = emailDetails.mailConfigurationId
    ? (emailConfigsData.find((config) => config.itemId === emailDetails.mailConfigurationId)
        ?.name ?? "-")
    : (resolveOrganizationDefault(emailConfigsData, organizationId)?.name ?? "-");
  const listPath =
    isMultiOrgEnabled && organizationId !== DEFAULT_ORGANIZATION_ID
      ? `${emailBasePath}?${EMAIL_ORGANIZATION_PARAM}=${encodeURIComponent(organizationId)}`
      : emailBasePath;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="mt-5 h-8 w-8 shrink-0 md:hidden"
            onClick={() => (onBack ? onBack() : navigate(-1))}
            aria-label={t("EMAIL_COMMUNICATION_DETAILS.GO_BACK")}
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
        <div className="flex shrink-0 justify-end gap-2 sm:self-end">
          {/* Only a Default organization template can be copied to organizations (SPEC33 H8, C1, C13). */}
          {isMultiOrgEnabled && organizationId === DEFAULT_ORGANIZATION_ID ? (
            <>
              <Button
                size="default"
                className="gap-2 shadow-none"
                onClick={() => setIsCopyDialogOpen(true)}
              >
                <CopyPlus className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  {t("COPY_TO_ORGANIZATIONS.BUTTON")}
                </span>
              </Button>
              <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                {isCopyDialogOpen ? (
                  <CopyToOrganizationsDialog
                    template={emailDetails}
                    languageName={languageName}
                    onClose={() => setIsCopyDialogOpen(false)}
                  />
                ) : null}
              </Dialog>
            </>
          ) : null}
          <Button
            size="default"
            variant="outline"
            className="gap-2 shadow-none hover:bg-white"
            onClick={sendTestEmailModalOpen}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              {t("EMAIL_COMMUNICATION_DETAILS.SEND_TEST_EMAIL")}
            </span>
          </Button>
          <Dialog open={isSendTestEmailModalOpen} onOpenChange={setIsSendTestEmailModalOpen}>
            {isSendTestEmailModalOpen ? (
              <SendTestEmailDialog
                template={emailDetails}
                to={userDetails?.email || ""}
                languageName={languageName}
                organizationName={organizationName}
                showOrganization={isMultiOrgEnabled}
                sendsThrough={sendsThrough}
                onClose={() => setIsSendTestEmailModalOpen(false)}
              />
            ) : null}
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="shadow-none"
                aria-label={t("EMAIL_COMMUNICATION_DETAILS.MORE_ACTIONS", {
                  name: emailDetails.name ?? "",
                })}
              >
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setIsCloneDialogOpen(true)}
              >
                <Copy className="mr-2 h-4 w-4" />
                <span>{t("EMAIL_TEMPLATE_LIST.CLONE_TEMPLATE")}</span>
              </DropdownMenuItem>
              {emailDetails.generatedBy !== "Tenant" && (
                <DropdownMenuItem
                  className="cursor-pointer text-error"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>{t("common:DELETE")}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
            {isCloneDialogOpen ? (
              <CloneTemplateDialog
                template={emailDetails}
                organizationName={organizationName}
                showOrganization={isMultiOrgEnabled}
                onClose={() => setIsCloneDialogOpen(false)}
                onCloned={(itemId) => {
                  setIsCloneDialogOpen(false);
                  navigate(scoped(`email-management/communications/${itemId}`));
                }}
              />
            ) : null}
          </Dialog>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            {isDeleteDialogOpen ? (
              <DeleteTemplateDialog
                template={emailDetails}
                languageName={languageName}
                organizationName={organizationName}
                isMultiOrgEnabled={isMultiOrgEnabled}
                onClose={() => setIsDeleteDialogOpen(false)}
                onDeleted={() => {
                  setIsDeleteDialogOpen(false);
                  navigate(listPath);
                }}
              />
            ) : null}
          </Dialog>
        </div>
      </div>
      <div className="grid min-h-136 min-w-0 flex-none grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.8fr)] overflow-hidden rounded-lg border border-border bg-card shadow-xs sm:min-h-152 sm:grid-cols-[minmax(0,2fr)_minmax(16rem,0.9fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,0.9fr)]">
        <section className="flex min-h-136 min-w-0 flex-col border-r border-border sm:min-h-152 xl:min-h-0">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-high-emphasis">
              {t("EMAIL_COMMUNICATION_DETAILS.TEMPLATE_PREVIEW")}
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
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {t("common:EDIT")}
              </span>
            </Button>
          </header>
          <div className="min-h-0 flex-1 bg-muted/30">
            <iframe
              title={t("EMAIL_COMMUNICATION_DETAILS.PREVIEW_FRAME_TITLE", {
                name: emailDetails.name || t("EMAIL_COMMUNICATION_DETAILS.EMAIL_TEMPLATE"),
              })}
              srcDoc={withStyleNonce(emailDetails.templateBody ?? "")}
              className="h-full min-h-120 w-full border-0 bg-white sm:min-h-136 xl:min-h-0"
            />
          </div>
        </section>
        <aside className="flex min-w-0 flex-col">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <h2 className="text-lg font-semibold tracking-tight text-high-emphasis">
              {t("common:DETAILS")}
            </h2>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="default"
                  variant="outline"
                  className="shrink-0 gap-2 shadow-none"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Pencil className="h-5 w-5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    {t("common:EDIT")}
                  </span>
                </Button>
              </DialogTrigger>
              <EditCommunication
                dialogTitle={t("EMAIL_COMMUNICATION_DETAILS.EDIT_TEMPLATE")}
                templateData={editData}
                onClose={() => {
                  setIsEditDialogOpen(false);
                }}
              />
            </Dialog>
          </header>
          <div className="grid gap-x-6 gap-y-7 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="grid min-w-0 gap-1 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              <h3 className="text-sm font-medium text-low-emphasis">
                {t("EMAIL_COMMUNICATION_DETAILS.SUBJECT")}
              </h3>
              <p className="wrap-break-word text-base font-medium text-high-emphasis">
                {emailDetails.templateSubject || "-"}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">
                {t("EMAIL_COMMUNICATION_DETAILS.LANGUAGE")}
              </h3>
              <p className="wrap-break-word text-base font-medium text-high-emphasis">
                {languageName}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">
                {t("EMAIL_COMMUNICATION_DETAILS.CONFIGURATION")}
              </h3>
              <div className="wrap-break-word text-base font-medium text-high-emphasis">
                <TemplateConfigurationName template={emailDetails} configs={emailConfigsData} />
              </div>
            </div>
            {isMultiOrgEnabled ? (
              <div className="grid min-w-0 gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">
                  {t("EMAIL_COMMUNICATION_DETAILS.ORGANIZATION")}
                </h3>
                <p className="wrap-break-word text-base font-medium text-high-emphasis">
                  {organizationName}
                </p>
              </div>
            ) : null}
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">
                {t("EMAIL_COMMUNICATION_DETAILS.CREATED_ON")}
              </h3>
              <p className="wrap-break-word text-base font-medium text-high-emphasis">
                {!emailDetails.createdDate || !checkValidDate(emailDetails.createdDate)
                  ? "-"
                  : formatFullDate(parseDateString(emailDetails.createdDate))}
              </p>
            </div>
            <div className="grid min-w-0 gap-1">
              <h3 className="text-sm font-medium text-low-emphasis">
                {t("EMAIL_COMMUNICATION_DETAILS.LAST_MODIFIED")}
              </h3>
              <p className="wrap-break-word text-base font-medium text-high-emphasis">
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
