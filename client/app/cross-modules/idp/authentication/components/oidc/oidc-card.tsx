import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { format } from "date-fns";
import { ChevronRight, LayoutTemplate, RotateCw, Shield, Trash2 } from "lucide-react";
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
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import {
  IDeleteOidcClientPayload,
  IOidcConfig,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { CreateOIDC } from "../create-oidc/create-oidc";
import { KVDetailItem } from "../kv-detail-item";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";

interface OIDCRowProps {
  item: IOidcConfig;
  defaultExpanded?: boolean;
}

const OIDCRow = ({ item, defaultExpanded = false }: OIDCRowProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [showRotatedSecretDialog, setShowRotatedSecretDialog] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: deleteOidc, isPending: isDeleting } = useDeleteAuthOidc({
    projectKey: tenantId,
  });
  const { mutateAsync: rotateSecret, isPending: isRotating } = useRotateAuthOidcSecret({
    projectKey: tenantId,
  });

  const clientSecret = rotatedSecret ?? item.clientSecret;

  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";

  const redirectUris =
    item.redirectUris && item.redirectUris.length
      ? item.redirectUris
      : item.redirectUri
        ? [item.redirectUri]
        : [];

  const responseTypes = item.allowedResponseTypes?.length ? item.allowedResponseTypes : ["code"];

  const kvPairs: {
    key: string;
    value: string;
    copyable?: boolean;
    sensitive?: boolean;
  }[] = [
    { key: "Client Id", value: item.itemId, copyable: true },
    { key: "Client Secret", value: clientSecret, sensitive: true },
    {
      key: "Redirect URI(s)",
      value: redirectUris.join(", "),
      copyable: true,
    },
    {
      key: "Allowed Response Types",
      value: responseTypes.join(", "),
    },
    {
      key: "Scope(s)",
      value: item.scope ?? "",
    },
    ...(item.isDeviceFlowClient
      ? []
      : [
          {
            key: "PKCE",
            value: item.requirePkce ? "required" : "not required",
          },
        ]),
    ...(item.isDeviceFlowClient
      ? []
      : [
          {
            key: "Redirect automatically after authentication",
            value: item.isAutoRedirect ? "true" : "false",
          },
        ]),
    {
      key: "Status",
      value: item.isActive ? "active" : "inactive",
    },
  ].filter((pair) => pair.value);

  const clientLabel = useMemo(
    () => item.clientDisplayName || item.itemId,
    [item.clientDisplayName, item.itemId],
  );

  const handleConfirmDelete = async () => {
    try {
      const payload: IDeleteOidcClientPayload = {
        itemId: item.itemId,
        projectKey: tenantId,
      };
      const res = await deleteOidc(payload);
      if (!res.isSuccess) return showErrorToast({ errors: res.error });
      showSuccessToast({ description: "OIDC credential deleted successfully" });
      setShowDeleteDialog(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const handleConfirmRotate = async () => {
    try {
      const res = await rotateSecret({
        itemId: item.itemId,
        projectKey: tenantId,
      });
      if (!res.isSuccess) {
        return showErrorToast({
          errors: res.errors ?? "Failed to rotate secret",
        });
      }
      setRotatedSecret(res.clientSecret);
      setShowRotateDialog(false);
      setShowRotatedSecretDialog(true);
      setExpanded(true);
      showSuccessToast({ description: "Client secret rotated successfully" });
    } catch (error) {
      if (isErrorWithErrors(error)) {
        return showErrorToast({ errors: error.errors });
      }
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <>
      <TableRow
        className={cn(
          "hover:bg-muted/50",
          kvPairs.length > 0 && "cursor-pointer",
          expanded && kvPairs.length > 0 ? "border-b-0" : "border-b-2 border-border",
        )}
        onClick={() => kvPairs.length > 0 && setExpanded((e) => !e)}
      >
        <TableCell className="w-8 py-3.5 pl-4">
          {kvPairs.length > 0 ? (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.clientDisplayName || item.itemId}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{item.itemId}</p>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden py-3.5 sm:table-cell">
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="w-fit gap-1.5 border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              OIDC
            </Badge>
            {item.isDeviceFlowClient && (
              <Badge
                variant="outline"
                className="w-fit border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
              >
                Device Flow
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="hidden py-3.5 text-sm text-muted-foreground md:table-cell">
          {createdAt}
        </TableCell>
        <TableCell className="py-3.5 pl-4 text-left" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-start gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                  aria-label="Template"
                  onClick={() => navigate(scoped(`secret-management/oidc/${item.itemId}/branding`))}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Template</TooltipContent>
            </Tooltip>
            <CreateOIDC itemId={item.itemId} triggerVariant="ghost" />
            {!item.isDeviceFlowClient && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                    aria-label="Rotate client secret"
                    onClick={() => setShowRotateDialog(true)}
                    disabled={isRotating}
                  >
                    <RotateCw className={cn("h-3.5 w-3.5", isRotating && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate Secret</TooltipContent>
              </Tooltip>
            )}
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="border-b-2 border-border hover:bg-transparent">
          <TableCell
            colSpan={5}
            className="max-w-0 bg-muted/20 px-3 py-3 pl-8 sm:px-6 sm:py-4 sm:pl-12"
          >
            <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
              {kvPairs.map(({ key, value, copyable, sensitive }) => (
                <KVDetailItem
                  key={key}
                  label={key}
                  value={value}
                  copyable={copyable}
                  sensitive={sensitive}
                />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}

      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate client secret</DialogTitle>
            <DialogDescription>
              Do you want to rotate the client secret for <strong>{clientLabel}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRotateDialog(false)}
              disabled={isRotating}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmRotate} disabled={isRotating}>
              {isRotating ? "Rotating…" : "Rotate Secret"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRotatedSecretDialog} onOpenChange={setShowRotatedSecretDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New client secret</DialogTitle>
            <DialogDescription>
              Copy the new secret for <strong>{clientLabel}</strong> now. The previous secret no
              longer works.
            </DialogDescription>
          </DialogHeader>
          {rotatedSecret ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 break-all text-sm">{rotatedSecret}</code>
              <CopyToClipboardButton textToCopy={rotatedSecret}>
                <span />
              </CopyToClipboardButton>
            </div>
          ) : null}
          <DialogFooter>
            <Button size="sm" onClick={() => setShowRotatedSecretDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OIDC Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{clientLabel}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const OIDCRowExport = OIDCRow;

export const OIDCCard = ({ oidc }: { oidc: IOidcConfig }) => {
  return <OIDCRow item={oidc} defaultExpanded />;
};
