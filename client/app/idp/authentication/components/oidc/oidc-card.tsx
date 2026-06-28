import { useState } from "react";
import {
  Eye,
  EyeOff,
  ChevronRight,
  Pencil,
  Trash2,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { getApiUrl } from "@/lib/get-api-path";
import {
  IDeleteOidcClientPayload,
  IOidcConfig,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useDeleteAuthOidc } from "@blocks-idp/authentication/hooks/use-auth-oidc";
import { DUMMY_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant";
import { format } from "date-fns";
import { CreateOIDC } from "../create-oidc/create-oidc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";

interface KVRowProps {
  label: string;
  value: string;
  isSecret?: boolean;
}

const KVRow = ({ label, value, isSecret = false }: KVRowProps) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <TableRow className="group bg-muted/20 hover:bg-muted/30">
      <TableCell className="w-8 pl-4" />
      <TableCell className="py-2 pl-8 font-mono text-xs text-muted-foreground" colSpan={1}>
        {label}
      </TableCell>
      <TableCell className="py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 font-mono text-xs">
            {value ? (
              revealed || !isSecret ? (
                <span className="break-all text-high-emphasis">{value}</span>
              ) : (
                <MaskedText text={value} length={Math.min(value.length, 36)} />
              )
            ) : (
              <span className="italic text-muted-foreground">empty</span>
            )}
          </div>
          {value && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {isSecret && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-high-emphasis"
                  onClick={() => setRevealed((r) => !r)}
                >
                  {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              )}
              <CopyToClipboardButton textToCopy={value}>
                <span />
              </CopyToClipboardButton>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell />
    </TableRow>
  );
};

interface OIDCRowProps {
  item: IOidcConfig;
  defaultExpanded?: boolean;
}

const OIDCRow = ({ item, defaultExpanded = false }: OIDCRowProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: deleteOidc, isPending: isDeleting } = useDeleteAuthOidc({
    projectKey: tenantId,
  });

  const createdAt = item.createdDate
    ? format(new Date(item.createdDate), "dd MMM yyyy")
    : "—";

  const redirectUris =
    item.redirectUris && item.redirectUris.length
      ? item.redirectUris
      : item.redirectUri
        ? [item.redirectUri]
        : [];

  const responseTypes = item.allowedResponseTypes?.length
    ? item.allowedResponseTypes
    : ["code"];

  const allowedServices = (item.allowedServiceAccessResources ?? [])
    .map((id) => DUMMY_LOG_SERVICES.find((s) => s.id === id)?.name ?? id)
    .join(", ");

  const wellKnownUrl = `${getApiUrl(
    "idp/v1",
    ".well-known/openid-configuration",
  )}?projectKey=${tenantId}`;

  const kvPairs: { key: string; value: string; isSecret?: boolean }[] = [
    { key: "Client Secret", value: item.clientSecret, isSecret: true },
    {
      key: "Redirect URI(s)",
      value: redirectUris.join(", "),
    },
    {
      key: "Allowed Response Types",
      value: responseTypes.join(", "),
    },
    {
      key: "Allowed Services",
      value: allowedServices,
    },
    {
      key: "Scope(s)",
      value: item.scope ?? "",
    },
    {
      key: "PKCE",
      value: item.requirePkce ? "Required" : "Not required",
    },
    {
      key: "IsAutoRedirect",
      value: item.isAutoRedirect ? "true" : "false",
    },
    {
      key: "IsActive",
      value: item.isActive ? "true" : "false",
    },
    {
      key: "Well Known URL",
      value: wellKnownUrl,
    },
  ].filter((pair) => pair.value);

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

  return (
    <>
      <TableRow
        className={`${kvPairs.length > 0 ? "cursor-pointer" : ""} hover:bg-muted/50`}
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
              <p className="truncate font-mono text-xs text-muted-foreground">
                {item.itemId}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="py-3.5">
          <Badge variant="outline" className="text-xs">
            OIDC
          </Badge>
        </TableCell>
        <TableCell className="py-3.5 text-sm text-muted-foreground">{createdAt}</TableCell>
        <TableCell className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <CreateOIDC itemId={item.itemId} triggerVariant="ghost" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded &&
        kvPairs.map(({ key, value, isSecret }) => (
          <KVRow key={key} label={key} value={value} isSecret={isSecret} />
        ))}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OIDC Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{item.clientDisplayName || item.itemId}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
            >
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
