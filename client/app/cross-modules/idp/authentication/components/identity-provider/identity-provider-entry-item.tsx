import { useState } from "react";
import { AlertTriangle, ChevronRight, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useDeleteIdentityProvider,
  useUpdateIdentityProviderStatus,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import { KVDetailItem } from "../kv-detail-item";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { PROVIDER_STATUS_DOT } from "./identity-provider-visual.constant";
import { getSocialLoginRedirectUri, hasRedirectUri } from "./identity-provider-form.util";
import { getBlocksIamBaseUrl } from "@blocks-idp/settings/utils/auth-config-form";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { format } from "date-fns";

interface ProviderEntryItemProps {
  item: IdentityProvider;
  defaultExpanded?: boolean;
}

/**
 * A single configured provider, rendered as a plain row inside its type's gallery card
 * (Blocks OIDC / Bring-your-own-SSO can have more than one entry). Carries the same
 * edit/enable-disable/delete actions and expandable KV details the old table row had.
 */
const isLoginRedirectUriMissing = (item: IdentityProvider, loginRedirectUri: string): boolean =>
  loginRedirectUri !== "" &&
  !hasRedirectUri(item.redirectUris ?? item.redirectUri, loginRedirectUri);

export function ProviderEntryItem({ item, defaultExpanded = false }: ProviderEntryItemProps) {
  const { t } = useT("os.idp.identity-provider");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateIdentityProviderStatus();
  const { mutateAsync: deleteProvider, isPending: isDeleting } = useDeleteIdentityProvider();

  const isActive = item.isActive;
  const statusDotClass = PROVIDER_STATUS_DOT[item.providerType] ?? "bg-emerald-500";
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const loginRedirectUri = getSocialLoginRedirectUri(
    getBlocksIamBaseUrl(),
    item.providerType,
    item.provider,
    tenantId,
  );
  const loginRedirectUriMissing = isLoginRedirectUriMissing(item, loginRedirectUri);

  const handleConfirmStatusChange = async () => {
    try {
      const res = await updateStatus({
        id: item.itemId!,
        request: { isActive: !item.isActive },
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: item.isActive
          ? t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLED_SUCCESS")
          : t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLED_SUCCESS"),
      });
      setShowStatusDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: t("IDENTITY_PROVIDER_ENTRY_ITEM.ERROR_GENERIC") });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await deleteProvider(item.itemId!);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETED_SUCCESS"),
      });
      setShowDeleteDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: t("IDENTITY_PROVIDER_ENTRY_ITEM.ERROR_GENERIC") });
    }
  };

  const providerLabel = item.displayName || item.provider;
  const willEnable = !isActive;

  const kvPairs: {
    key: string;
    label: string;
    value: string;
    copyable?: boolean;
    sensitive?: boolean;
    masked?: boolean;
  }[] = [
    {
      key: "clientId",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.CLIENT_ID"),
      value: item.clientId ?? "",
      copyable: true,
      masked: true,
    },
    {
      key: "issuerUrl",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.ISSUER_URL"),
      value: item.issuer ?? "",
      copyable: true,
    },
    {
      key: "authorizationUrl",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.AUTHORIZATION_URL"),
      value: item.authorizationUrl ?? "",
      copyable: true,
    },
    {
      key: "tokenUrl",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.TOKEN_URL"),
      value: item.tokenUrl ?? "",
      copyable: true,
    },
    {
      key: "userInfoUrl",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.USER_INFO_URL"),
      value: item.userInfoUrl ?? "",
      copyable: true,
    },
    {
      key: "wellKnownUri",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.WELL_KNOWN_URI"),
      value: item.wellKnownUrl ?? "",
      copyable: true,
    },
    { key: "scope", label: t("IDENTITY_PROVIDER_ENTRY_ITEM.SCOPE"), value: item.scope ?? "" },
    {
      key: "audience",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.AUDIENCE"),
      value: item.audience ?? "",
    },
    {
      key: "redirectUris",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.REDIRECT_URIS"),
      value: (item.redirectUris ?? item.redirectUri)?.join(", ") ?? "",
      copyable: true,
    },
    {
      key: "iamLoginRedirectUri",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.IAM_LOGIN_REDIRECT_URI"),
      value: loginRedirectUri,
      copyable: true,
    },
    {
      key: "roles",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.ROLES"),
      value: item.initialRoles?.length ? item.initialRoles.join(", ") : "",
    },
    {
      key: "permissions",
      label: t("IDENTITY_PROVIDER_ENTRY_ITEM.PERMISSIONS"),
      value: item.initialPermissions?.length ? item.initialPermissions.join(", ") : "",
    },
  ].filter((pair) => pair.value);

  return (
    <li className={cn("rounded-md border border-border/60", !isActive && "opacity-75")}>
      <div
        className={cn(
          "flex items-center gap-2.5 px-2.5 py-2",
          kvPairs.length > 0 && "cursor-pointer",
        )}
        onClick={() => kvPairs.length > 0 && setExpanded((e) => !e)}
      >
        {kvPairs.length > 0 ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <span className="block h-3.5 w-3.5 shrink-0" />
        )}
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            isActive ? statusDotClass : "bg-muted-foreground/40",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{item.displayName}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{item.provider}</p>
        </div>
        {loginRedirectUriMissing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex shrink-0 items-center gap-1 text-[11px] text-warning-700"
                data-testid="login-redirect-uri-missing"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {t("IDENTITY_PROVIDER_ENTRY_ITEM.REDIRECT_URI_MISSING")}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t("IDENTITY_PROVIDER_ENTRY_ITEM.REDIRECT_URI_MISSING_TOOLTIP")}
            </TooltipContent>
          </Tooltip>
        )}
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
          {createdAt}
        </span>
        <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                aria-label={t("IDENTITY_PROVIDER_ENTRY_ITEM.EDIT_PROVIDER")}
                onClick={() => setShowEditModal(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common:EDIT")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0",
                  isActive
                    ? "text-emerald-600 hover:text-destructive"
                    : "text-muted-foreground hover:text-emerald-600",
                )}
                aria-label={
                  isActive
                    ? t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLE_PROVIDER")
                    : t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLE_PROVIDER")
                }
                onClick={() => setShowStatusDialog(true)}
                disabled={isUpdating}
              >
                {isActive ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isActive
                ? t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLE")
                : t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLE")}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                aria-label={t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETE_PROVIDER")}
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common:DELETE")}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
          <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
            {kvPairs.map(({ key, label, value, copyable, sensitive, masked }) => (
              <KVDetailItem
                key={key}
                label={label}
                value={value}
                copyable={copyable}
                sensitive={sensitive}
                masked={masked}
              />
            ))}
          </div>
        </div>
      )}

      <IdentityProviderFormDialog
        open={showEditModal}
        onOpenChange={(open) => {
          if (!open) setShowEditModal(false);
        }}
        editId={item.itemId}
      />

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {willEnable
                ? t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLE_TITLE")
                : t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLE_TITLE")}
            </DialogTitle>
            <DialogDescription>
              {willEnable
                ? t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLE_DESCRIPTION", { name: providerLabel })
                : t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLE_DESCRIPTION", { name: providerLabel })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusDialog(false)}
              disabled={isUpdating}
            >
              {t("common:CANCEL")}
            </Button>
            <Button
              variant={willEnable ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmStatusChange}
              disabled={isUpdating}
            >
              {isUpdating
                ? willEnable
                  ? t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLING")
                  : t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLING")
                : willEnable
                  ? t("IDENTITY_PROVIDER_ENTRY_ITEM.ENABLE")
                  : t("IDENTITY_PROVIDER_ENTRY_ITEM.DISABLE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETE_TITLE")}</DialogTitle>
            <DialogDescription>
              {isActive
                ? t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETE_DESCRIPTION_ACTIVE", {
                    name: providerLabel,
                  })
                : t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETE_DESCRIPTION_INACTIVE", {
                    name: providerLabel,
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t("common:CANCEL")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("IDENTITY_PROVIDER_ENTRY_ITEM.DELETING") : t("common:DELETE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
