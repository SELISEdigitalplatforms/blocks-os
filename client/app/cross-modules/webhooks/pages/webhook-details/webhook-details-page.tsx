import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { WebhookFormDialog } from "../../components/webhook-form-dialog";
import { WebhookHistory } from "../../components/webhook-history";
import { WebhookInfoCards } from "../../components/webhook-info-cards";
import { WEBHOOK_ERROR_CODES, WEBHOOKS_I18N_MODULE } from "../../constants/webhooks.constant";
import {
  useDeleteWebhook,
  useGetWebhook,
  useSaveWebhook,
  useTestWebhook,
} from "../../hooks/use-webhooks";
import type { IWebhook } from "../../models/webhook.model";
import { getErrorCode, webhookErrorMessages } from "../../utils/webhook-errors";

const LIST_PATH = "secret-management/webhooks";

export function WebhookDetailsPage() {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { data: webhook, isLoading, error, refetch } = useGetWebhook(id);
  const { mutateAsync: testWebhook, isPending: isTesting } = useTestWebhook();
  const { mutateAsync: saveWebhook, isPending: isSaving } = useSaveWebhook();
  const { mutateAsync: deleteWebhook, isPending: isDeleting } = useDeleteWebhook();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const backLink = (
    <Link
      to={scoped(LIST_PATH)}
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-high-emphasis"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>{t("DETAILS.BACK")}</span>
    </Link>
  );

  const reportError = (title: string, caught: unknown) => {
    const code = getErrorCode(caught);
    showErrorToast({
      title,
      errors: code ? { code } : t("ERRORS.UNEXPECTED"),
      customMessages: webhookErrorMessages(),
    });
  };

  const handleTest = async () => {
    try {
      const result = await testWebhook(id);
      const status = result.httpStatus === null ? "-" : `HTTP ${result.httpStatus}`;
      if (result.delivered) {
        showSuccessToast({
          title: t("DETAILS.TEST_DELIVERED"),
          description: t("DETAILS.TEST_RESULT", { status, ms: result.durationMs }),
        });
      } else {
        showErrorToast({
          title: t("DETAILS.TEST_FAILED"),
          errors: t("DETAILS.TEST_RESULT_ERROR", {
            status,
            ms: result.durationMs,
            code: result.errorCode ?? "",
          }),
        });
      }
    } catch (caught) {
      reportError(t("DETAILS.TEST_FAILED"), caught);
    }
  };

  const handleToggleActive = async (current: IWebhook) => {
    try {
      await saveWebhook({
        id: current.id,
        name: current.name,
        url: current.url,
        isActive: !current.isActive,
        actions: current.actions,
      });
      showSuccessToast({
        description: t(current.isActive ? "DETAILS.TURNED_OFF" : "DETAILS.TURNED_ON", {
          name: current.name,
        }),
      });
    } catch (caught) {
      reportError(t("FORM.COULD_NOT_SAVE"), caught);
    }
  };

  const handleDelete = async (current: IWebhook) => {
    try {
      await deleteWebhook(current.id);
      showSuccessToast({ description: t("DETAILS.DELETED", { name: current.name }) });
      navigate(scoped(LIST_PATH));
    } catch (caught) {
      setIsDeleteOpen(false);
      reportError(t("DETAILS.COULD_NOT_DELETE"), caught);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (!webhook) {
    const isMissing = getErrorCode(error) === WEBHOOK_ERROR_CODES.WebhookNotFound;
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <p className="text-sm text-muted-foreground">
          {t(isMissing ? "DETAILS.NOT_FOUND" : "DETAILS.LOAD_FAILED")}
        </p>
        {!isMissing && (
          <Button className="w-fit" variant="outline" onClick={() => refetch()}>
            {t("common:RETRY")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {backLink}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{webhook.name}</h1>
          <code className="break-all text-sm text-muted-foreground">{webhook.url}</code>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={isTesting} onClick={handleTest}>
            {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <span>{t("DETAILS.SEND_TEST")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            {t("common:EDIT")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => handleToggleActive(webhook)}
          >
            {webhook.isActive ? t("DETAILS.TURN_OFF") : t("DETAILS.TURN_ON")}
          </Button>
          <Button variant="destructive-outline" size="sm" onClick={() => setIsDeleteOpen(true)}>
            {t("common:DELETE")}
          </Button>
        </div>
      </header>

      <WebhookInfoCards webhook={webhook} />

      <section className="flex flex-col gap-2" aria-label={t("DETAILS.ACTIONS_IT_RECEIVES")}>
        <h2 className="text-base font-semibold text-high-emphasis">
          {t("DETAILS.ACTIONS_IT_RECEIVES")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {webhook.actions.map((name) => (
            <li key={name}>
              <Badge variant="outline" className="font-mono font-normal">
                {name}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <WebhookHistory webhookId={webhook.id} actions={webhook.actions} />

      <WebhookFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} webhook={webhook} />
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={t("DETAILS.DELETE_TITLE")}
        description={t("DETAILS.DELETE_DESCRIPTION", { name: webhook.name })}
        confirmLabel={t("common:DELETE")}
        cancelLabel={t("common:CANCEL")}
        onConfirm={() => handleDelete(webhook)}
        isPending={isDeleting}
        destructive
      />
    </div>
  );
}
