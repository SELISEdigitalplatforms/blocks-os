import { useState } from "react";
import { ChevronRight, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
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
export function ProviderEntryItem({ item, defaultExpanded = false }: ProviderEntryItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateIdentityProviderStatus();
  const { mutateAsync: deleteProvider, isPending: isDeleting } = useDeleteIdentityProvider();

  const isActive = item.isActive;
  const statusDotClass = PROVIDER_STATUS_DOT[item.providerType] ?? "bg-emerald-500";
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";

  const handleConfirmStatusChange = async () => {
    try {
      const res = await updateStatus({
        id: item.itemId!,
        request: { isActive: !item.isActive },
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: `Identity provider ${item.isActive ? "disabled" : "enabled"} successfully`,
      });
      setShowStatusDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await deleteProvider(item.itemId!);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: "Identity provider deleted successfully",
      });
      setShowDeleteDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const providerLabel = item.displayName || item.provider;
  const willEnable = !isActive;

  const kvPairs: {
    key: string;
    value: string;
    copyable?: boolean;
    sensitive?: boolean;
  }[] = [
    { key: "Client Id", value: item.clientId ?? "", copyable: true },
    { key: "Client Secret", value: item.clientSecret ?? "", sensitive: true },
    { key: "Issuer URL", value: item.issuer ?? "", copyable: true },
    {
      key: "Authorization URL",
      value: item.authorizationUrl ?? "",
      copyable: true,
    },
    { key: "Token URL", value: item.tokenUrl ?? "", copyable: true },
    { key: "User Info URL", value: item.userInfoUrl ?? "", copyable: true },
    { key: "Well-known URI", value: item.wellKnownUrl ?? "", copyable: true },
    { key: "Scope", value: item.scope ?? "" },
    { key: "Audience", value: item.audience ?? "" },
    {
      key: "Redirect URI(s)",
      value: (item.redirectUris ?? item.redirectUri)?.join(", ") ?? "",
      copyable: true,
    },
    {
      key: "Roles",
      value: item.initialRoles?.length ? item.initialRoles.join(", ") : "",
    },
    {
      key: "Permissions",
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
                aria-label="Edit provider"
                onClick={() => setShowEditModal(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
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
                aria-label={isActive ? "Disable provider" : "Enable provider"}
                onClick={() => setShowStatusDialog(true)}
                disabled={isUpdating}
              >
                {isActive ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isActive ? "Disable" : "Enable"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete provider"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
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
              {willEnable ? "Enable identity provider" : "Disable identity provider"}
            </DialogTitle>
            <DialogDescription>
              {willEnable ? (
                <>
                  Users will be able to sign in with <strong>{providerLabel}</strong>. Are you sure
                  you want to enable this provider?
                </>
              ) : (
                <>
                  Users will no longer be able to sign in with <strong>{providerLabel}</strong>. Are
                  you sure you want to disable this provider?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant={willEnable ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmStatusChange}
              disabled={isUpdating}
            >
              {isUpdating
                ? willEnable
                  ? "Enabling…"
                  : "Disabling…"
                : willEnable
                  ? "Enable"
                  : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete identity provider</DialogTitle>
            <DialogDescription>
              {isActive ? (
                <>
                  Users will no longer be able to sign in with <strong>{providerLabel}</strong>.
                  This provider and its configuration will be permanently removed.
                </>
              ) : (
                <>
                  <strong>{providerLabel}</strong> and its configuration will be permanently
                  removed. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
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
    </li>
  );
}
