import { useMemo, useState } from "react";
import { ChevronRight, KeyRound, Pencil, Power, PowerOff, RotateCw, Trash2 } from "lucide-react";
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
import { maskId } from "../../utils/mask-id.util";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  IClientCredentialsConfig,
  ISaveClientCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useDeleteAuthClient,
  useRotateAuthClientSecret,
  useSaveAuthClient,
} from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { format } from "date-fns";
import { KVDetailItem } from "../kv-detail-item";
import { OneTimeSecret, OneTimeSecretDialog } from "../one-time-secret-dialog";

const KEY_ERROR_GENERIC = "CLIENT_CREDENTIALS_LIST.ERROR_GENERIC";
const KEY_COMMON_CANCEL = "common:CANCEL";

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
  const { t } = useT("os.idp.client-credentials");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<OneTimeSecret | null>(null);
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: saveClient, isPending: isUpdating } = useSaveAuthClient({
    projectKey: tenantId,
  });
  const { mutateAsync: deleteClient, isPending: isDeleting } = useDeleteAuthClient({
    projectKey: tenantId,
  });
  const { mutateAsync: rotateSecret, isPending: isRotating } = useRotateAuthClientSecret({
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
        return showErrorToast({ errors: apiErrors ?? t("CLIENT_CREDENTIALS_LIST.UPDATE_FAILED") });
      }
      showSuccessToast({
        description: item.isActive
          ? t("CLIENT_CREDENTIALS_LIST.DISABLED_SUCCESS")
          : t("CLIENT_CREDENTIALS_LIST.ENABLED_SUCCESS"),
      });
      setShowStatusDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: t(KEY_ERROR_GENERIC) });
    }
  };

  const handleConfirmRotate = async () => {
    try {
      const res = await rotateSecret({ itemId: item.itemId });
      if (res?.isSuccess && res.clientSecret) {
        setShowRotateDialog(false);
        setRotatedSecret({
          label: item.name,
          clientId: item.itemId,
          clientSecret: res.clientSecret,
          reason: "rotated",
        });
        showSuccessToast({ description: t("CLIENT_CREDENTIALS_LIST.ROTATED_SUCCESS") });
      } else {
        showErrorToast({
          errors: getBackendErrorMap(res) ?? t("CLIENT_CREDENTIALS_LIST.ROTATE_FAILED"),
        });
      }
    } catch (err) {
      showErrorToast({
        errors: isErrorWithErrors(err) ? err.errors : t(KEY_ERROR_GENERIC),
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      const res = await deleteClient({ itemId: item.itemId });
      if (!res?.isSuccess) {
        const apiErrors = getBackendErrorMap(res);
        return showErrorToast({ errors: apiErrors ?? t("CLIENT_CREDENTIALS_LIST.DELETE_FAILED") });
      }
      showSuccessToast({ description: t("CLIENT_CREDENTIALS_LIST.DELETED_SUCCESS") });
      setShowDeleteDialog(false);
    } catch (err) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: t(KEY_ERROR_GENERIC) });
    }
  };

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
      label: t("CLIENT_CREDENTIALS_LIST.CLIENT_ID"),
      value: item.itemId ?? "",
      copyable: true,
      masked: true,
    },
    // Shown even when it is the tenant-wide "default", because that is the most privileged
    // scope a credential can have and is worth seeing rather than inferring from an absence.
    {
      key: "organization",
      label: t("CLIENT_CREDENTIALS_LIST.ORGANIZATION"),
      value:
        item.organizationId === "default"
          ? t("CLIENT_CREDENTIALS_LIST.ORGANIZATION_DEFAULT")
          : (item.organizationId ?? ""),
    },
    {
      key: "tokenLifetime",
      label: t("CLIENT_CREDENTIALS_LIST.TOKEN_LIFETIME"),
      value: formatLifetime(item.accessTokenValidForNumberMinutes),
    },
    {
      key: "roles",
      label: t("CLIENT_CREDENTIALS_LIST.ROLES"),
      value: item.roles?.length ? item.roles.join(", ") : "",
    },
    {
      key: "permissions",
      label: t("CLIENT_CREDENTIALS_LIST.PERMISSIONS"),
      value: item.permissions?.length ? item.permissions.join(", ") : "",
    },
    {
      key: "updatedOn",
      label: t("CLIENT_CREDENTIALS_LIST.UPDATED_ON"),
      value: formatDateTime(item.lastUpdatedDate),
    },
  ].filter((pair) => pair.value);

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          expanded ? "border-b-0" : "border-b-2 border-border",
          !isActive && "opacity-75",
        )}
        onClick={() => setExpanded((e) => !e)}
      >
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
              <p className="truncate font-mono text-xs text-muted-foreground">
                {maskId(item.itemId)}
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
                isActive ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {isActive
              ? t("CLIENT_CREDENTIALS_LIST.STATUS_ACTIVE")
              : t("CLIENT_CREDENTIALS_LIST.STATUS_INACTIVE")}
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
                    aria-label={t("CLIENT_CREDENTIALS_LIST.EDIT")}
                    onClick={() => onEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common:EDIT")}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                  aria-label={t("CLIENT_CREDENTIALS_LIST.ROTATE_SECRET_LABEL")}
                  onClick={() => setShowRotateDialog(true)}
                  disabled={isRotating}
                >
                  <RotateCw className={cn("h-3.5 w-3.5", isRotating && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("CLIENT_CREDENTIALS_LIST.ROTATE_SECRET")}</TooltipContent>
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
                  aria-label={
                    isActive
                      ? t("CLIENT_CREDENTIALS_LIST.DISABLE_LABEL")
                      : t("CLIENT_CREDENTIALS_LIST.ENABLE_LABEL")
                  }
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
              <TooltipContent>
                {isActive
                  ? t("CLIENT_CREDENTIALS_LIST.DISABLE")
                  : t("CLIENT_CREDENTIALS_LIST.ENABLE")}
              </TooltipContent>
            </Tooltip>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={t("CLIENT_CREDENTIALS_LIST.DELETE_LABEL")}
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("common:DELETE")}</TooltipContent>
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
          </TableCell>
        </TableRow>
      )}

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {willEnable
                ? t("CLIENT_CREDENTIALS_LIST.ENABLE_TITLE")
                : t("CLIENT_CREDENTIALS_LIST.DISABLE_TITLE")}
            </DialogTitle>
            <DialogDescription>
              {willEnable
                ? t("CLIENT_CREDENTIALS_LIST.ENABLE_DESCRIPTION", { name: item.name })
                : t("CLIENT_CREDENTIALS_LIST.DISABLE_DESCRIPTION", { name: item.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusDialog(false)}
              disabled={isUpdating}
            >
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button
              variant={willEnable ? "default" : "destructive"}
              size="sm"
              onClick={handleConfirmStatusChange}
              disabled={isUpdating}
            >
              {isUpdating
                ? willEnable
                  ? t("CLIENT_CREDENTIALS_LIST.ENABLING")
                  : t("CLIENT_CREDENTIALS_LIST.DISABLING")
                : willEnable
                  ? t("CLIENT_CREDENTIALS_LIST.ENABLE")
                  : t("CLIENT_CREDENTIALS_LIST.DISABLE")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("CLIENT_CREDENTIALS_LIST.ROTATE_TITLE")}</DialogTitle>
            <DialogDescription>
              {t("CLIENT_CREDENTIALS_LIST.ROTATE_DESCRIPTION", { name: item.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRotateDialog(false)}
              disabled={isRotating}
            >
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button size="sm" onClick={handleConfirmRotate} disabled={isRotating}>
              {isRotating
                ? t("CLIENT_CREDENTIALS_LIST.ROTATING")
                : t("CLIENT_CREDENTIALS_LIST.ROTATE_SECRET")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OneTimeSecretDialog secret={rotatedSecret} onClose={() => setRotatedSecret(null)} />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("CLIENT_CREDENTIALS_LIST.DELETE_TITLE")}</DialogTitle>
            <DialogDescription>
              {t("CLIENT_CREDENTIALS_LIST.DELETE_DESCRIPTION", { name: item.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("CLIENT_CREDENTIALS_LIST.DELETING") : t("common:DELETE")}
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
  const { t } = useT("os.idp.client-credentials");
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
        title={t("CLIENT_CREDENTIALS_LIST.EMPTY_TITLE")}
        description={t("CLIENT_CREDENTIALS_LIST.EMPTY_DESCRIPTION")}
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
                {t("CLIENT_CREDENTIALS_LIST.COLUMN_CLIENT")}
              </TableHead>
              <TableHead className="hidden w-32 text-xs font-semibold uppercase tracking-wide text-high-emphasis sm:table-cell">
                {t("common:STATUS")}
              </TableHead>
              <TableHead className="hidden w-40 text-xs font-semibold uppercase tracking-wide text-high-emphasis md:table-cell">
                {t("CLIENT_CREDENTIALS_LIST.COLUMN_CREATED_ON")}
              </TableHead>
              <TableHead className="w-36" />
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
