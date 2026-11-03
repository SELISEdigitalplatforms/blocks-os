import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { isErrorWithErrors } from "@/lib/error";
import { useArchiveSignupLinkConfiguration } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";
import { useT } from "@seliseblocks/genesis-os";
import { Pencil, Ticket, Trash2 } from "lucide-react";
import { useState } from "react";
import { UpdateConfiguration } from "../update-configuration/update-configuration";
import { AddConfiguration } from "../add-configuration/add-configuration";
import { existingUserPasswordLabel, maxRedemptionsLabel } from "../max-redemptions";

type ConfigurationsListProps = {
  items: ISignupLinkConfiguration[];
  isLoading: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  isForbidden: boolean;
  isError: boolean;
  onRetry: () => void;
};

const SKELETON_ROW_KEYS = ["row-1", "row-2", "row-3", "row-4", "row-5"];

const LoadingSkeleton = () => (
  <div className="flex flex-col gap-3" data-testid="configurations-loading">
    {SKELETON_ROW_KEYS.map((key) => (
      <Skeleton key={key} className="h-[72px] w-full rounded-xl" />
    ))}
  </div>
);

export const ConfigurationsList = ({
  items,
  isLoading,
  hasActiveFilters,
  onClearFilters,
  isForbidden,
  isError,
  onRetry,
}: ConfigurationsListProps) => {
  const { t } = useT("os.idp.signup-links");
  const [selected, setSelected] = useState<ISignupLinkConfiguration | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ISignupLinkConfiguration | null>(null);
  const { mutateAsync: archive, isPending: isArchiving } = useArchiveSignupLinkConfiguration();

  if (isForbidden) {
    return (
      <div
        className="flex min-h-[320px] items-center justify-center rounded-xl py-16 text-center text-sm text-muted-foreground"
        data-testid="configurations-forbidden"
      >
        {t("CONFIGURATIONS_LIST.FORBIDDEN")}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground"
        data-testid="configurations-error"
      >
        <p>{t("CONFIGURATIONS_LIST.LOAD_ERROR")}</p>
        <Button variant="outline" onClick={onRetry}>
          {t("common:RETRY")}
        </Button>
      </div>
    );
  }

  if (isLoading) return <LoadingSkeleton />;

  if (!items.length) {
    if (hasActiveFilters) {
      return (
        <div
          className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground"
          data-testid="configurations-no-match"
        >
          <p>{t("CONFIGURATIONS_LIST.NO_MATCH")}</p>
          <Button variant="outline" onClick={onClearFilters}>
            {t("CONFIGURATIONS_LIST.CLEAR_FILTERS")}
          </Button>
        </div>
      );
    }
    return (
      <div
        className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
        data-testid="configurations-empty"
      >
        <Ticket className="h-6 w-6 text-muted-foreground" />
        <h2 className="text-base font-semibold text-high-emphasis">
          {t("CONFIGURATIONS_LIST.EMPTY_TITLE")}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {t("CONFIGURATIONS_LIST.EMPTY_BODY")}
        </p>
        <AddConfiguration />
      </div>
    );
  }

  const confirmArchive = async () => {
    if (!pendingArchive) return;
    try {
      await archive(pendingArchive.itemId);
      showSuccessToast({ description: t("CONFIGURATIONS_LIST.ARCHIVED_TOAST") });
      setPendingArchive(null);
    } catch (error) {
      if (isHttpErrorStatus(error, 404)) {
        showErrorToast({ errors: t("CONFIGURATIONS_LIST.NOT_FOUND") });
        setPendingArchive(null);
        return;
      }
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: t("CONFIGURATIONS_LIST.GENERIC_ERROR") });
    }
  };

  return (
    <>
      <div className="scrollbar-hidden-x overflow-x-hidden md:overflow-x-auto">
        <div className="flex flex-col gap-3 md:min-w-[1060px]">
          <div className="hidden grid-cols-[minmax(180px,1.2fr)_140px_minmax(140px,1fr)_100px_100px_120px_100px_88px] items-center gap-4 px-4 md:grid">
            <span className="font-bold text-medium-emphasis">{t("common:NAME")}</span>
            <span className="font-bold text-medium-emphasis">
              {t("CONFIGURATIONS_LIST.COLUMN_CREDENTIAL_MODE")}
            </span>
            <span className="font-bold text-medium-emphasis">
              {t("CONFIGURATIONS_LIST.COLUMN_DEFAULT_ROLES")}
            </span>
            <span className="font-bold text-medium-emphasis">
              {t("CONFIGURATIONS_LIST.COLUMN_LIFETIME")}
            </span>
            <span className="font-bold text-medium-emphasis">
              {t("CONFIGURATIONS_LIST.COLUMN_MAX_USES")}
            </span>
            <span className="font-bold text-medium-emphasis">
              {t("CONFIGURATIONS_LIST.COLUMN_EXISTING_PASSWORD")}
            </span>
            <span className="font-bold text-medium-emphasis">{t("common:STATUS")}</span>
            <span />
          </div>

          {items.map((row) => (
            <div
              key={row.itemId}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:grid md:grid-cols-[minmax(180px,1.2fr)_140px_minmax(140px,1fr)_100px_100px_120px_100px_88px] md:items-center md:gap-4"
              data-testid={`configuration-row-${row.itemId}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Ticket className="h-4 w-4" />
                </div>
                <p className="truncate text-sm font-semibold text-high-emphasis" title={row.name}>
                  {row.name}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("CONFIGURATIONS_LIST.COLUMN_CREDENTIAL_MODE")}
                </span>
                <Badge variant="secondary" className="font-normal">
                  {row.credentialMode}
                </Badge>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("CONFIGURATIONS_LIST.COLUMN_DEFAULT_ROLES")}
                </span>
                <p className="truncate text-sm text-muted-foreground">
                  {row.defaultRoles?.length ? row.defaultRoles.join(", ") : "—"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("CONFIGURATIONS_LIST.COLUMN_LIFETIME")}
                </span>
                <p className="text-sm text-muted-foreground">
                  {t("CONFIGURATIONS_LIST.LIFETIME_VALUE", { minutes: row.defaultLifetimeMinutes })}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("CONFIGURATIONS_LIST.COLUMN_MAX_USES")}
                </span>
                <p className="text-sm text-muted-foreground" data-testid="max-uses">
                  {maxRedemptionsLabel(row.defaultMaxRedemptions)}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("CONFIGURATIONS_LIST.COLUMN_EXISTING_PASSWORD")}
                </span>
                <Badge
                  variant="secondary"
                  className="font-normal"
                  data-testid="existing-user-password"
                >
                  {existingUserPasswordLabel(row.requireExistingUserPassword)}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-muted-foreground md:hidden">
                  {t("common:STATUS")}
                </span>
                {row.isActive ? (
                  <Badge variant="secondary" className="font-normal">
                    {t("CONFIGURATIONS_LIST.STATUS_ACTIVE")}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal">
                    {t("CONFIGURATIONS_LIST.STATUS_ARCHIVED")}
                  </Badge>
                )}
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  size="icon"
                  className="rounded-full"
                  variant="ghost"
                  aria-label={t("CONFIGURATIONS_LIST.EDIT_ARIA", { name: row.name })}
                  onClick={() => setSelected(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {row.isActive && (
                  <Button
                    size="icon"
                    className="rounded-full"
                    variant="ghost"
                    aria-label={t("CONFIGURATIONS_LIST.ARCHIVE_ARIA", { name: row.name })}
                    onClick={() => setPendingArchive(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) setSelected(null);
          }}
        >
          <UpdateConfiguration configuration={selected} isOpen onClose={() => setSelected(null)} />
        </Dialog>
      )}

      <Dialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
      >
        {pendingArchive && (
          <ConfirmationModal
            data={{
              dialogTitle: t("CONFIGURATIONS_LIST.ARCHIVE_TITLE"),
              dialogSubtitle: t("CONFIGURATIONS_LIST.ARCHIVE_SUBTITLE", {
                name: pendingArchive.name,
              }),
              confirmButton: isArchiving
                ? t("CONFIGURATIONS_LIST.ARCHIVING")
                : t("CONFIGURATIONS_LIST.ARCHIVE_CONFIRM"),
              cancelButton: t("common:CANCEL"),
            }}
            onCancel={() => setPendingArchive(null)}
            onConfirm={confirmArchive}
            buttonState={{ confirm: { disable: isArchiving } }}
          />
        )}
      </Dialog>
    </>
  );
};
