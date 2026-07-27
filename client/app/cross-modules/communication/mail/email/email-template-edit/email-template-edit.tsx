import { Button } from "@/components/ui-kits/button/button";
import BeePluginStarter from "@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter";
import { useState, useRef } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useNavigate } from "react-router-dom";
import { useScopedPath } from "@seliseblocks/blocks-kit/hooks";
import {
  useGetEmailTemplate,
  useSaveEmailTemplate,
} from "@blocks-communication/mail/hooks/use-email-template";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

export function EditEmailTemplate({ params }: { params: { id: string } }) {
  const { id } = params;
  const { isLoading, isFetching, data } = useGetEmailTemplate(id);
  const [emailDetails, setEmailDetails] = useState<IEmailTemplate | null>(null);
  const { saveEmailTemplate, isPending } = useSaveEmailTemplate();
  const beeRef = useRef<{
    submit: () => void;
    preview: () => void;
    reset: () => void;
  }>();
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
            <Skeleton className="h-10 w-20 rounded" />
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card shadow-none">
          <Skeleton className="h-80 w-full rounded" />
        </div>
      </div>
    );
  }

  const emailBasePath = scoped("email-management");
  BREADCRUMB_CUSTOM_TITLES[emailBasePath] = "Email Management";
  BREADCRUMB_CUSTOM_TITLES[`${emailBasePath}/communications`] = null;
  BREADCRUMB_CUSTOM_TITLES[`${emailBasePath}/communications/${emailDetails.itemId}`] =
    emailDetails.name ?? "";
  BREADCRUMB_CUSTOM_TITLES[`${emailBasePath}/communications/${emailDetails.itemId}/edit`] = "Edit";

  const handleBeePluginData = async (data: { htmlFile: string; jsonFile: string }) => {
    const currentData: IEmailTemplate = {
      itemId: emailDetails?.itemId || "",
      templateBody: data.htmlFile,
      jsonContent: data.jsonFile,
    };
    await saveEmailTemplate(currentData);
    setTemplateData(currentData);
    navigate(scoped(`email-management/communications/${emailDetails.itemId}`));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <PageBreadcrumb
          breadcrumbIndex={3}
          className="flex min-w-0"
          listClassName="text-base sm:text-lg"
        />
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="default"
            className="gap-1 text-sm font-medium shadow-none"
            disabled={isLoading || isFetching}
            onClick={() => beeRef?.current?.reset()}
          >
            <span className="sr-only sm:not-sr-only">Reset</span>
          </Button>
          <Button
            variant="outline"
            size="default"
            className="gap-1 text-sm font-medium shadow-none"
            disabled={isLoading || isFetching}
            onClick={() => beeRef?.current?.preview()}
          >
            <span className="sr-only sm:not-sr-only">Preview</span>
          </Button>
          <Button
            disabled={isPending || isLoading || isFetching}
            size="default"
            onClick={() => {
              beeRef?.current?.submit();
            }}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="mb-8 overflow-hidden rounded-sm border border-border bg-card shadow-none">
        <BeePluginStarter
          onBeeSave={handleBeePluginData}
          ref={beeRef}
          jsonFile={emailDetails.jsonContent ? JSON.parse(emailDetails.jsonContent) : undefined}
        />
      </div>
    </div>
  );
}
