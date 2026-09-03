import { useMemo, useState } from "react";
import { ChevronRight, KeyRound, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { MaskedText } from "@/components/masked-text/masked-text";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  IClientCredentialsConfig,
  ISaveClientCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useDeleteAuthClient,
  useSaveAuthClient,
} from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { format } from "date-fns";
import { KVDetailItem } from "../kv-detail-item";

const SKELETON_ROWS = 3;

const getBackendErrorMap = (response: unknown) => {
  if (!response || typeof response !== "object") return undefined;

  const typedResponse = response as {
    errors?: unknown;
    error?: { errors?: unknown };
  };

  if (typedResponse.errors && typeof typedResponse.errors === "object") {
    return typedResponse.errors as Record<string, string | string[]>;
  }

  if (typedResponse.error?.errors && typeof typedResponse.error.errors === "object") {
    return typedResponse.error.errors as Record<string, string | string[]>;
  }

  return undefined;
};

const formatLifetime = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem === 0 ? `${hours} h` : `${hours} h ${rem} m`;
  }
  const days = Math.floor(minutes / 1440);
  const rem = minutes % 1440;
  if (rem === 0) return `${days} d`;
  const hours = Math.floor(rem / 60);
  return hours === 0 ? `${days} d ${rem} m` : `${days} d ${hours} h`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy HH:mm");
};

interface ClientCredentialRowProps {
  item: IClientCredentialsConfig;
  defaultExpanded?: boolean;
  onEdit?: (client: IClientCredentialsConfig) => void;
}

const ClientCredentialRow = ({
  item,
  defaultExpanded = false,
  onEdit,
}: ClientCredentialRowProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: saveClient, isPending: isUpdating } = useSaveAuthClient({
    projectKey: tenantId,
  });
  const { mutateAsync: deleteClient, isPending: isDeleting } = useDeleteAuthClient({
    projectKey: tenantId,
  });

  const isActive = item.isActive;
  const createdAt = item.createdDate ? format(new Date(item.createdDate), "dd MMM yyyy") : "—";
  const willEnable = !isActive;

  const handleConfirmStatusChange = async () => {
    try {
      const payload: ISaveClientCredentialPayload = {
        itemId: item.itemId,
        name: item.name,
        isActive: !item.isActive,
        accessTokenValidForNumberMinutes: item.accessTokenValidForNumberMinutes,
        roles: item.roles,
        permissions: item.permissions,
        projectKey: tenantId,
      };
      const res = await saveClient(payload);
      if (!res?.isSuccess) {
        const apiErrors = getBackendErrorMap(res);
        return showErrorToast({ errors: apiErrors ?? "Failed to update client credential." });
      }
      showSuccessToast({
        description: `Client credential ${item.isActive ? "disabled" : "enabled"} successfully`,
      });
      setShowStatusDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await deleteClient({ itemId: item.itemId });
      if (!res?.isSuccess) {
        const apiErrors = getBackendErrorMap(res);
        return showErrorToast({ errors: apiErrors ?? "Failed to delete client credential." });
      }
      showSuccessToast({ description: "Client credential deleted successfully" });
      setShowDeleteDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const kvPairs: {
    key: string;
    value: string;
    copyable?: boolean;
    sensitive?: boolean;
  }[] = [
    { key: "Client Id", value: item.itemId ?? "", copyable: true },
    { key: "Client Secret", value: item.clientSecret ?? "", sensitive: true },
    // Shown even when it is the tenant-wide "default", because that is the most privileged
    // scope a credential can have and is worth seeing rather than inferring from an absence.
    {
      key: "Organization",
      value: item.organizationId === "default" ? "Default (tenant-wide)" : (item.organizationId ?? ""),
    },
    { key: "Token Lifetime", value: formatLifetime(item.accessTokenValidForNumberMinutes) },
    { key: "Role(s)", value: item.roles?.length ? item.roles.join(", ") : "" },
    { key: "Permission(s)", value: item.permissions?.length ? item.permissions.join(", ") : "" },
    { key: "Updated on", value: formatDateTime(item.lastUpdatedDate) },
  ].filter((pair) => pair.value);

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          expanded ? "border-b-0" : "border-b-2 border-border",
          !isActive && "opacity-75",
        )}
        onClick={() => setExpanded((e) => !e)}>
        <TableCell className="w-8 py-3.5 pl-4">
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        </TableCell>
        <TableCell className="py-3.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isActive ? "bg-primary/10" : "bg-muted",
              )}
            >
              <KeyRound
                className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <div className="truncate font-mono text-xs text-muted-foreground">
                <MaskedText text={item.itemId ?? ""} length={20} showFirstN={4} showLastN={4} />
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="hidden py-3.5 sm:table-cell">
          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-transparent bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-high-emphasis">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isActive ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell className="hidden py-3.5 text-sm text-muted-foreground md:table-cell">
          {createdAt}
        </TableCell>
        <TableCell className="py-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    aria-label="Edit client credential"
                    onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
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
                  aria-label={isActive ? "Disable client credential" : "Enable client credential"}
                  onClick={() => setShowStatusDialog(true)}
                  disabled={isUpdating}>
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
                  aria-label="Delete client credential"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}>
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

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {willEnable ? "Enable client credential" : "Disable client credential"}
            </DialogTitle>
            <DialogDescription>
              {willEnable ? (
                <>
                  <strong>{item.name}</strong> will be able to obtain new tokens again. Are you
                  sure you want to enable it?
                </>
              ) : (
                <>
                  <strong>{item.name}</strong> will no longer be able to obtain new tokens. Are
                  you sure you want to disable it?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusDialog(false)}
              disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              variant={willEnable ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmStatusChange}
              disabled={isUpdating}>
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
            <DialogTitle>Delete client credential</DialogTitle>
            <DialogDescription>
              <strong>{item.name}</strong> and its configuration will be permanently removed. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}>
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
        <div key={i} className="flex items-center gap-4 border-b px-4 py-4 last:border-0">
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

type ClientCredentialListProps = {
  data: IClientCredentialsConfig[];
  isLoading: boolean;
  onEdit?: (client: IClientCredentialsConfig) => void;
};

export const ClientCredentialList = ({ data, isLoading, onEdit }: ClientCredentialListProps) => {
  const sortedClientsData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => {
      const dateA = new Date(a.createdDate).getTime();
      const dateB = new Date(b.createdDate).getTime();
      return dateB - dateA;
    });
  }, [data]);

  if (isLoading) return <LoadingSkeleton />;

  if (!sortedClientsData.length) {
    return (
      <EmptyState
        icon={KeyRound}
        title="No client credentials yet"
        description="Create one to issue OAuth client credentials for service-to-service access."
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
                Client
              </TableHead>
              <TableHead className="hidden w-32 text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:table-cell">
                Status
              </TableHead>
              <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-high-emphasis md:table-cell">
                Created On
              </TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {sortedClientsData.map((client, index) => (
              <ClientCredentialRow
                key={client.itemId}
                item={client}
                defaultExpanded={index === 0}
                onEdit={onEdit}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
