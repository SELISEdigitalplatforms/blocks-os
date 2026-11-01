import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Power, PowerOff, RotateCw, Shield, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { TableCell, TableRow } from "@/components/ui-kits/table/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  useDeleteAuthOidc,
  useRotateAuthOidcSecret,
  useSaveAuthOidc,
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import {
  IDeleteOidcClientPayload,
  IOidcConfig,
  ISaveOidcCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import type { IOidcClientLoginPolicy } from "@blocks-idp/authentication/models/login-policy.model";
import { describeClientLoginPolicy } from "@blocks-idp/authentication/utils/login-policy.util";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { CreateOIDC } from "../create-oidc/create-oidc";
import { KVDetailItem } from "../kv-detail-item";
import { maskId } from "../../utils/mask-id.util";
import { OneTimeSecret, OneTimeSecretDialog } from "../one-time-secret-dialog";

interface OIDCRowProps {
  item: IOidcConfig;
  /** From the list response; missing means the client follows the project setting. */
  loginPolicy?: IOidcClientLoginPolicy;
  defaultExpanded?: boolean;
}

type KvPair = {
  key: string;
  value: string;
  copyable?: boolean;
  sensitive?: boolean;
  masked?: boolean;
};

const getRedirectUris = (item: IOidcConfig): string[] => {
  if (item.redirectUris?.length) return item.redirectUris;
  return item.redirectUri ? [item.redirectUri] : [];
};

const getResponseTypes = (item: IOidcConfig): string[] =>
  item.allowedResponseTypes?.length ? item.allowedResponseTypes : ["code"];

const buildKvPairs = (item: IOidcConfig): KvPair[] => {
  const browserOnly: KvPair[] = item.isDeviceFlowClient
    ? []
    : [
        { key: "PKCE", value: item.requirePkce ? "required" : "not required" },
        {
          key: "Redirect automatically after authentication",
          value: item.isAutoRedirect ? "true" : "false",
        },
      ];
  const pairs: KvPair[] = [
    { key: "Client Id", value: item.itemId, copyable: true, masked: true },
    { key: "Redirect URI(s)", value: getRedirectUris(item).join(", "), copyable: true },
    { key: "Allowed Response Types", value: getResponseTypes(item).join(", ") },
    { key: "Scope(s)", value: item.scope ?? "" },
    ...browserOnly,
  ];
  return pairs.filter((pair) => pair.value);
};

/**
 * The save endpoint replaces the whole client, so a status toggle resends its current configuration and
 * flips only isActive -- the same shape the edit form submits. No loginPolicy: the server keeps it.
 */
const buildStatusTogglePayload = (item: IOidcConfig): ISaveOidcCredentialPayload => {
  const device = item.isDeviceFlowClient ?? false;
  return {
    itemId: item.itemId,
    clientDisplayName: item.clientDisplayName,
    redirectUris: device ? [] : getRedirectUris(item),
    scope: item.scope,
    isAutoRedirect: device ? false : item.isAutoRedirect,
    isActive: !item.isActive,
    requirePkce: device ? false : item.requirePkce,
    registerAsIdentityProvider: device ? false : (item.registerAsIdentityProvider ?? false),
    isDeviceFlowClient: device,
    allowedResponseTypes: device ? [] : getResponseTypes(item),
    allowedServiceAccessResources: item.allowedServiceAccessResources,
    // Resend the stored client type and token delivery so a status toggle never turns a
    // public (for example Mobile app) client confidential or back to cookie delivery.
    clientType: item.clientType,
    useTokensCookie: item.useTokensCookie,
  };
};

const statusButtonLabel = (isUpdating: boolean, willEnable: boolean): string => {
  if (isUpdating) return willEnable ? "Enabling…" : "Disabling…";
  return willEnable ? "Enable" : "Disable";
};

const showActionError = (error: unknown) => {
  showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
};

const OidcClientNameCell = ({
  item,
  loginPolicy,
}: Readonly<{ item: IOidcConfig; loginPolicy?: IOidcClientLoginPolicy }>) => (
  <TableCell className="py-3.5">
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          item.isActive ? "bg-emerald-100 dark:bg-emerald-950" : "bg-muted",
        )}
      >
        <Shield
          className={cn(
            "h-4 w-4",
            item.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.clientDisplayName || "OIDC client"}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">{maskId(item.itemId)}</p>
        {!item.isDeviceFlowClient && (
          <p className="truncate text-xs text-muted-foreground">
            {describeClientLoginPolicy(loginPolicy)}
          </p>
        )}
      </div>
    </div>
  </TableCell>
);

const OidcTypeCell = ({ isDeviceFlowClient }: Readonly<{ isDeviceFlowClient?: boolean }>) => (
  <TableCell className="hidden py-3.5 sm:table-cell">
    <div className="flex flex-wrap gap-1.5">
      <Badge
        variant="outline"
        className="w-fit gap-1.5 border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        {"OIDC"}
      </Badge>
      {isDeviceFlowClient && (
        <Badge
          variant="outline"
          className="w-fit border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
        >
          Device Flow
        </Badge>
      )}
    </div>
  </TableCell>
);

const OidcStatusCell = ({ isActive }: Readonly<{ isActive: boolean }>) => (
  <TableCell className="hidden py-3.5 sm:table-cell">
    <Badge
      variant="outline"
      className="w-fit gap-1.5 border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isActive ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {isActive ? "Active" : "Inactive"}
    </Badge>
  </TableCell>
);

type OidcRowActionsProps = Readonly<{
  item: IOidcConfig;
  isRotating: boolean;
  isUpdating: boolean;
  onRotate: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}>;

const OidcRowActions = ({
  item,
  isRotating,
  isUpdating,
  onRotate,
  onToggleStatus,
  onDelete,
}: OidcRowActionsProps) => {
  const isActive = item.isActive;
  return (
    <TableCell className="py-3.5 pl-4 text-left" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-start gap-1">
        <CreateOIDC itemId={item.itemId} triggerVariant="ghost" />
        {!item.isDeviceFlowClient && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                aria-label="Rotate client secret"
                onClick={onRotate}
                disabled={isRotating}
              >
                <RotateCw className={cn("h-3.5 w-3.5", isRotating && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rotate Secret</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                isActive
                  ? "text-emerald-600 hover:text-destructive"
                  : "text-muted-foreground hover:text-emerald-600",
              )}
              aria-label={isActive ? "Disable OIDC client" : "Enable OIDC client"}
              onClick={onToggleStatus}
              disabled={isUpdating}
            >
              {isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isActive ? "Disable" : "Enable"}</TooltipContent>
        </Tooltip>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Delete"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      </div>
    </TableCell>
  );
};

const OidcDetailsRow = ({ kvPairs }: Readonly<{ kvPairs: KvPair[] }>) => (
  <TableRow className="border-b-2 border-border hover:bg-transparent">
    <TableCell colSpan={6} className="max-w-0 bg-muted/20 px-3 py-3 pl-8 sm:px-6 sm:py-4 sm:pl-12">
      <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
        {kvPairs.map(({ key, value, copyable, sensitive, masked }) => (
          <KVDetailItem
            key={key}
            label={key}
            value={value}
            copyable={copyable}
            sensitive={sensitive}
            masked={masked}
          />
        ))}
      </div>
    </TableCell>
  </TableRow>
);

type ConfirmDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientLabel: string;
  isPending: boolean;
  onConfirm: () => void;
}>;

const OidcStatusDialog = ({
  open,
  onOpenChange,
  clientLabel,
  isPending,
  onConfirm,
  willEnable,
}: ConfirmDialogProps & Readonly<{ willEnable: boolean }>) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{willEnable ? "Enable OIDC client" : "Disable OIDC client"}</DialogTitle>
        <DialogDescription>
          {willEnable ? (
            <>
              <strong>{clientLabel}</strong> will be able to sign users in again. Are you sure you
              want to enable it?
            </>
          ) : (
            <>
              <strong>{clientLabel}</strong> will no longer be able to sign users in. Are you sure
              you want to disable it?
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant={willEnable ? "default" : "destructive"}
          size="sm"
          onClick={onConfirm}
          disabled={isPending}
        >
          {statusButtonLabel(isPending, willEnable)}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const OidcRotateDialog = ({
  open,
  onOpenChange,
  clientLabel,
  isPending,
  onConfirm,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Rotate client secret</DialogTitle>
        <DialogDescription>
          A new secret will be made for <strong>{clientLabel}</strong>. The current secret stops
          working at once, so every app that uses it must be updated.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={isPending}>
          {isPending ? "Rotating…" : "Rotate Secret"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const OidcDeleteDialog = ({
  open,
  onOpenChange,
  clientLabel,
  isPending,
  onConfirm,
}: ConfirmDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete OIDC Client</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete <strong>{clientLabel}</strong>? This action cannot be
          undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isPending}>
          {isPending ? "Deleting…" : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const OIDCRow = ({ item, loginPolicy, defaultExpanded = false }: Readonly<OIDCRowProps>) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<OneTimeSecret | null>(null);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: deleteOidc, isPending: isDeleting } = useDeleteAuthOidc({
    projectKey: tenantId,
  });
  const { mutateAsync: rotateSecret, isPending: isRotating } = useRotateAuthOidcSecret({
    projectKey: tenantId,
  });
  const { mutateAsync: saveOidc, isPending: isUpdating } = useSaveAuthOidc();

  const isActive = item.isActive;
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";
  const kvPairs = buildKvPairs(item);
  const hasDetails = kvPairs.length > 0;

  const clientLabel = useMemo(
    () => item.clientDisplayName || maskId(item.itemId),
    [item.clientDisplayName, item.itemId],
  );

  const handleConfirmDelete = async () => {
    try {
      const payload: IDeleteOidcClientPayload = {
        itemId: item.itemId,
        projectKey: tenantId,
      };
      const res = await deleteOidc(payload);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.error });
        return;
      }
      showSuccessToast({ description: "OIDC credential deleted successfully" });
      setShowDeleteDialog(false);
    } catch (error) {
      showActionError(error);
    }
  };

  const handleConfirmStatusChange = async () => {
    try {
      const res = await saveOidc(buildStatusTogglePayload(item));
      if (!res.isSuccess) {
        showErrorToast({ errors: res.error });
        return;
      }
      showSuccessToast({
        description: `OIDC client ${isActive ? "disabled" : "enabled"} successfully`,
      });
      setShowStatusDialog(false);
    } catch (error) {
      showActionError(error);
    }
  };

  const handleConfirmRotate = async () => {
    try {
      const res = await rotateSecret({
        itemId: item.itemId,
        projectKey: tenantId,
      });
      if (!res.isSuccess || !res.clientSecret) {
        showErrorToast({ errors: res.errors ?? "Failed to rotate secret" });
        return;
      }
      setShowRotateDialog(false);
      setRotatedSecret({
        label: clientLabel,
        clientId: res.clientId || item.itemId,
        clientSecret: res.clientSecret,
        reason: "rotated",
      });
      showSuccessToast({ description: "Client secret rotated successfully" });
    } catch (error) {
      showActionError(error);
    }
  };

  return (
    <>
      <TableRow
        className={cn(
          "hover:bg-muted/50",
          hasDetails && "cursor-pointer",
          expanded && hasDetails ? "border-b-0" : "border-b-2 border-border",
          !isActive && "opacity-75",
        )}
        onClick={() => hasDetails && setExpanded((e) => !e)}
      >
        <TableCell className="w-8 py-3.5 pl-4">
          {hasDetails ? (
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-90",
              )}
            />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </TableCell>
        <OidcClientNameCell item={item} loginPolicy={loginPolicy} />
        <OidcTypeCell isDeviceFlowClient={item.isDeviceFlowClient} />
        <OidcStatusCell isActive={isActive} />
        <TableCell className="hidden py-3.5 text-sm text-muted-foreground md:table-cell">
          {createdAt}
        </TableCell>
        <OidcRowActions
          item={item}
          isRotating={isRotating}
          isUpdating={isUpdating}
          onRotate={() => setShowRotateDialog(true)}
          onToggleStatus={() => setShowStatusDialog(true)}
          onDelete={() => setShowDeleteDialog(true)}
        />
      </TableRow>

      {expanded && <OidcDetailsRow kvPairs={kvPairs} />}

      <OidcStatusDialog
        open={showStatusDialog}
        onOpenChange={setShowStatusDialog}
        clientLabel={clientLabel}
        isPending={isUpdating}
        onConfirm={handleConfirmStatusChange}
        willEnable={!isActive}
      />

      <OidcRotateDialog
        open={showRotateDialog}
        onOpenChange={setShowRotateDialog}
        clientLabel={clientLabel}
        isPending={isRotating}
        onConfirm={handleConfirmRotate}
      />

      <OneTimeSecretDialog secret={rotatedSecret} onClose={() => setRotatedSecret(null)} />

      <OidcDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        clientLabel={clientLabel}
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};

export const OIDCRowExport = OIDCRow;

export const OIDCCard = ({
  oidc,
  loginPolicy,
}: {
  oidc: IOidcConfig;
  loginPolicy?: IOidcClientLoginPolicy;
}) => {
  return <OIDCRow item={oidc} loginPolicy={loginPolicy} defaultExpanded />;
};
