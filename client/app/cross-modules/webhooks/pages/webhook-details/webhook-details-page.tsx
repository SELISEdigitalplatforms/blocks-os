import { useState } from "react";
import { Webhook } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { SectionCardHeader } from "../../components/section-card-header";
import { WebhookDetailsNav, WEBHOOKS_LIST_PATH } from "../../components/webhook-details-nav";
import { WebhookDetailsSkeleton } from "../../components/webhook-details-skeleton";
import { WebhookFormDialog } from "../../components/webhook-form-dialog";
import { WebhookHeaderCard } from "../../components/webhook-header-card";
import { WebhookHistory } from "../../components/webhook-history";
import { WEBHOOK_ERROR_CODES, WEBHOOKS_I18N_MODULE } from "../../constants/webhooks.constant";
import {
  useDeleteWebhook,
  useGetWebhook,
  useSaveWebhook,
  useTestWebhook,
} from "../../hooks/use-webhooks";
import type { IWebhook } from "../../models/webhook.model";
import { getErrorCode, webhookErrorMessages } from "../../utils/webhook-errors";

const ACTIONS_PATH = "secret-management/actions";

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
      const status =
        result.httpStatus === null ? "-" : t("HISTORY.HTTP_STATUS", { status: result.httpStatus });
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
    } catch (error_) {
      reportError(t("DETAILS.TEST_FAILED"), error_);
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
    } catch (error_) {
      reportError(t("FORM.COULD_NOT_SAVE"), error_);
    }
  };

  const handleDelete = async (current: IWebhook) => {
    try {
      await deleteWebhook(current.id);
      showSuccessToast({ description: t("DETAILS.DELETED", { name: current.name }) });
      navigate(scoped(WEBHOOKS_LIST_PATH));
    } catch (error_) {
      setIsDeleteOpen(false);
      reportError(t("DETAILS.COULD_NOT_DELETE"), error_);
    }
  };

  if (isLoading) {
    return <WebhookDetailsSkeleton />;
  }

  if (!webhook) {
    const isMissing = getErrorCode(error) === WEBHOOK_ERROR_CODES.WebhookNotFound;
    return (
      <div className="flex flex-col gap-6">
        <WebhookDetailsNav />
        {isMissing ? (
          <EmptyState
            icon={Webhook}
            title={t("DETAILS.NOT_FOUND")}
            description={t("DETAILS.NOT_FOUND_DESCRIPTION")}
            action={
              <Button variant="outline" onClick={() => navigate(scoped(WEBHOOKS_LIST_PATH))}>
                {t("DETAILS.BACK_TO_LIST")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Webhook}
            title={t("DETAILS.LOAD_FAILED")}
            description={t("LIST.LOAD_FAILED_DESCRIPTION")}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                {t("common:RETRY")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WebhookDetailsNav name={webhook.name} />

      <WebhookHeaderCard
        webhook={webhook}
        isTesting={isTesting}
        isSaving={isSaving}
        onTest={handleTest}
        onEdit={() => setIsEditOpen(true)}
        onToggleActive={() => handleToggleActive(webhook)}
        onDelete={() => setIsDeleteOpen(true)}
      />

      <section aria-label={t("DETAILS.ACTIONS_IT_RECEIVES")}>
        <Card className="overflow-hidden p-0">
          <SectionCardHeader
            title={t("DETAILS.ACTIONS_IT_RECEIVES")}
            count={webhook.actions.length}
          >
            <Link
              to={scoped(ACTIONS_PATH)}
              className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("DETAILS.MANAGE_ACTIONS")}
            </Link>
          </SectionCardHeader>
          <ul className="flex flex-wrap gap-2 px-5 py-4">
            {webhook.actions.map((name) => (
              <li key={name}>
                <Badge variant="outline" className="font-mono font-normal">
                  {name}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
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
