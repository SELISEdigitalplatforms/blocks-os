import { useState } from "react";
import {
  Building2,
  ChevronRight,
  Pencil,
  Power,
  PowerOff,
  Shield,
  Trash2,
  Users,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { EmptyState } from "@/components/ui-kits/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  useDeleteIdentityProvider,
  useGetIdentityProviders,
  useUpdateIdentityProviderStatus,
} from "@blocks-idp/authentication/hooks/use-identity-provider";
import { KVDetailItem } from "../kv-detail-item";
import { IdentityProviderFormDialog } from "./identity-provider-form-dialog";
import { format } from "date-fns";

const PROVIDER_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  social: {
    label: "Social",
    Icon: Users,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  byos: {
    label: "BYOS",
    Icon: Key,
    iconBg: "bg-purple-100 dark:bg-purple-950",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  "blocks-oidc": {
    label: "Blocks OIDC",
    Icon: Shield,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

const DEFAULT_PROVIDER_CONFIG = {
  label: "OIDC",
  Icon: Shield,
  iconBg: "bg-muted",
  iconColor: "text-muted-foreground",
  statusDot: "bg-muted-foreground/40",
};

const PROVIDER_STATUS_DOT: Record<string, string> = {
  social: "bg-blue-500",
  byos: "bg-purple-500",
  "blocks-oidc": "bg-emerald-500",
};

const SKELETON_ROWS = 3;

interface IdentityProviderRowProps {
  item: IdentityProvider;
  defaultExpanded?: boolean;
}

const IdentityProviderRow = ({
  item,
  defaultExpanded = false,
}: IdentityProviderRowProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { mutateAsync: updateStatus, isPending: isUpdating } =
    useUpdateIdentityProviderStatus();
  const { mutateAsync: deleteProvider, isPending: isDeleting } =
    useDeleteIdentityProvider();

  const cfg = PROVIDER_CONFIG[item.providerType] ?? DEFAULT_PROVIDER_CONFIG;
  const Icon = cfg.Icon;
  const isActive = item.isActive;
  const statusDotClass =
    PROVIDER_STATUS_DOT[item.providerType] ?? "bg-emerald-500";
  const createdAt = item.createdDate
    ? format(new Date(item.createdDate), "dd MMM yyyy")
    : "—";

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

  const kvPairs: { key: string; value: string; copyable?: boolean }[] = [
    { key: "Client ID", value: item.clientId ?? "", copyable: true },
    { key: "Client Secret", value: item.clientSecret ?? "", copyable: true },
    { key: "Issuer URL", value: item.issuer ?? "", copyable: true },
    { key: "Authorization URL", value: item.authorizationUrl ?? "", copyable: true },
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
      value: item.initialPermissions?.length
        ? item.initialPermissions.join(", ")
        : "",
    },
  ].filter((pair) => pair.value);

  return (
    <>
      <TableRow
        className={cn(
          "hover:bg-muted/50",
          kvPairs.length > 0 && "cursor-pointer",
          expanded && kvPairs.length > 0
            ? "border-b-0"
            : "border-b-2 border-border",
          !isActive && "opacity-75",
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
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isActive ? cfg.iconBg : "bg-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isActive ? cfg.iconColor : "text-muted-foreground",
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.displayName}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {item.provider}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden py-3.5 sm:table-cell">
          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis"
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isActive ? statusDotClass : "bg-muted-foreground/40",
              )}
            />
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="hidden py-3.5 text-sm text-muted-foreground md:table-cell">
          {createdAt}
        </TableCell>
        <TableCell
          className="py-3.5 pr-4 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label="Edit provider"
                  onClick={() => setShowEditModal(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
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
                    "h-7 w-7 p-0",
                    isActive
                      ? "text-emerald-600 hover:text-destructive"
                      : "text-muted-foreground hover:text-emerald-600",
                  )}
                  aria-label={isActive ? "Disable provider" : "Enable provider"}
                  onClick={() => setShowStatusDialog(true)}
                  disabled={isUpdating}
                >
                  {isActive ? (
                    <Power className="h-3.5 w-3.5" />
                  ) : (
                    <PowerOff className="h-3.5 w-3.5" />
                  )}
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
                  aria-label="Delete provider"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
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
          <TableCell colSpan={5} className="max-w-0 bg-muted/20 px-3 py-3 pl-8 sm:px-6 sm:py-4 sm:pl-12">
            <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
              {kvPairs.map(({ key, value, copyable }) => (
                <KVDetailItem
                  key={key}
                  label={key}
                  value={value}
                  copyable={copyable}
                />
              ))}
            </div>
          </TableCell>
        </TableRow>
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
                  Users will be able to sign in with{" "}
                  <strong>{providerLabel}</strong>. Are you sure you want to enable
                  this provider?
                </>
              ) : (
                <>
                  Users will no longer be able to sign in with{" "}
                  <strong>{providerLabel}</strong>. Are you sure you want to disable
                  this provider?
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
                  Users will no longer be able to sign in with{" "}
                  <strong>{providerLabel}</strong>. This provider and its
                  configuration will be permanently removed.
                </>
              ) : (
                <>
                  <strong>{providerLabel}</strong> and its configuration will be
                  permanently removed. This cannot be undone.
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
    </>
  );
};

const LoadingSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b px-4 py-4 last:border-0"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex flex-1 items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <div className="ml-auto flex gap-1.5">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

export function IdentityProviderList() {
  const { data, isLoading } = useGetIdentityProviders();

  const providers = data?.data ?? [];

  if (isLoading) return <LoadingSkeleton />;

  if (providers.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No identity providers yet"
        description="Add your first identity provider to get started."
      />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-clip p-0 sm:overflow-x-auto">
        <Table className="w-full min-w-0 sm:table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-4" />
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:w-64">
                Provider
              </TableHead>
              <TableHead className="hidden w-32 text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:table-cell">
                Type
              </TableHead>
              <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-high-emphasis md:table-cell">
                Created On
              </TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {providers.map((provider, index) => (
              <IdentityProviderRow
                key={provider.itemId}
                item={provider}
                defaultExpanded={index === 0}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
