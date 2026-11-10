import { Button } from "@/components/ui-kits/button/button";
import MailcraftEditor, {
  IMailcraftEditorRef,
} from "@blocks-communication/mail/components/mailcraft-editor/mailcraft-editor";
import { useState, useRef } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useT } from "@seliseblocks/genesis-os";
import {
  useGetEmailTemplate,
  useSaveEmailTemplate,
} from "@blocks-communication/mail/hooks/use-email-template";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";

const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;

/**
 * True for a refusal worth showing as is: an HTTP status below 500 whose field map holds at least
 * one non-blank message, such as the mail template HTML policy's 400 `TemplateBody` problem.
 * A 5xx, a transport failure (the HTTP client reports it as a 500), or an empty or blank map has
 * nothing the user can act on, so the caller shows the generic text instead.
 */
const isShowableRefusal = (
  error: unknown,
): error is { status: number; errors: Record<string, string | string[]> } => {
  if (!isErrorWithErrors(error)) return false;
  const { status } = error as { status?: unknown };
  if (typeof status !== "number" || status >= 500) return false;
  return Object.values(error.errors).some((value) =>
    Array.isArray(value) ? value.some(hasText) : hasText(value),
  );
};

export function EditEmailTemplate({ params }: { params: { id: string } }) {
  const { t } = useT("os.communication.mail");
  const { id } = params;
  const { isLoading, isFetching, data } = useGetEmailTemplate(id);
  const [emailDetails, setEmailDetails] = useState<IEmailTemplate | null>(null);
  const { saveEmailTemplate, isPending } = useSaveEmailTemplate();
  const editorRef = useRef<IMailcraftEditorRef | null>(null);
  const [, setTemplateData] = useState<IEmailTemplate>({
    itemId: "",
  });
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [prevSync, setPrevSync] = useState<{ id: typeof id; data: typeof data } | undefined>(
    undefined,
  );
  if (!prevSync || prevSync.id !== id || prevSync.data !== data) {
    setPrevSync({ id, data });
    if (id) {
      setEmailDetails(data || null);
    }
  }
  if (!emailDetails || isLoading || isFetching) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
          <Skeleton className="h-7 w-64" />
          <div className="flex shrink-0 gap-2">
            <Skeleton className="h-10 w-20 rounded" />
            <Skeleton className="h-10 w-20 rounded" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const emailBasePath = scoped("email-management");
  const breadcrumbTitles = {
    [emailBasePath]: t("EMAIL_TEMPLATE_EDIT.BREADCRUMB_EMAIL_MANAGEMENT"),
    [`${emailBasePath}/communications`]: null,
    [`${emailBasePath}/communications/${emailDetails.itemId}`]: emailDetails.name ?? "",
    [`${emailBasePath}/communications/${emailDetails.itemId}/edit`]: t("common:EDIT"),
  };

  const handleEditorSave = async (data: { htmlFile: string }) => {
    const currentData: IEmailTemplate = {
      itemId: emailDetails?.itemId || "",
      templateBody: data.htmlFile,
    };
    try {
      await saveEmailTemplate(currentData);
    } catch (error) {
      // The editor's submit() doesn't await this handler, so a rethrow would surface as an
      // unhandled rejection. Stay on the page without resetting, so the user's edits are kept.
      const title = t("EMAIL_TEMPLATE_EDIT.SAVE_FAILED_TITLE");
      if (isShowableRefusal(error)) {
        showErrorToast({ title, errors: error.errors, customMessages: templateErrorMessages(t) });
      } else {
        showErrorToast({ title, errors: t("EMAIL_TEMPLATE_EDIT.SAVE_FAILED_DESCRIPTION") });
      }
      return;
    }
    setTemplateData(currentData);
    navigate(scoped(`email-management/communications/${emailDetails.itemId}`));
  };

  return (
    <div className="flex min-h-160 min-w-0 flex-1 flex-col lg:min-h-0">
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
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
        <div className="flex shrink-0 items-center justify-end gap-2 sm:self-end">
          <Button
            variant="outline"
            size="default"
            className="gap-1 text-sm font-medium shadow-none"
            disabled={isLoading || isFetching}
            onClick={() => editorRef?.current?.reset()}
          >
            <span className="sr-only sm:not-sr-only">{t("common:RESET")}</span>
          </Button>
          <Button
            disabled={isPending || isLoading || isFetching}
            size="default"
            onClick={() => {
              editorRef?.current?.submit();
            }}
          >
            {t("common:SAVE")}
          </Button>
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border-l border-border">
        <MailcraftEditor
          embedded
          onSave={handleEditorSave}
          ref={editorRef}
          html={emailDetails.templateBody || undefined}
          templateName={emailDetails.name ?? ""}
        />
      </div>
    </div>
  );
}
