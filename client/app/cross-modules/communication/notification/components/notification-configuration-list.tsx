import React, { useState } from "react";
import {
  useDeleteNotificationConfig,
  useGetNotificationConfigs,
} from "../hooks/use-notification-config";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ConfigsTableShell } from "@/components/configs-table-shell/configs-table-shell";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Bell, EllipsisVertical, Pencil, Trash } from "lucide-react";
import NewNotificationConfiguration from "../modals/new-notification-configuration";
import {
  NOTIFICATION_CONFIG_ERROR_MESSAGES,
  notificationImportances,
  notificationKinds,
  notificationTypes,
} from "../constants/notification.constant";
import { getErrorMessage, isErrorWithErrors } from "@/lib/error";
import { Badge } from "@/components/ui-kits/badge/badge";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  NotificationConfigsFilterToolBar,
  useNotificationConfigsFilterQueryParams,
} from "./notification-configs-filter-toolbar";
import { useQueryState, parseAsBoolean } from "nuqs";

const columns = [
  { key: "name", label: "Name" },
  { key: "importance", label: "Importance" },
  { key: "kind", label: "Kind" },
  { key: "sourceService", label: "Service" },
  { key: "notificationType", label: "Receiver" },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5"];

interface NotificationConfigurationListProps {
  isLoading?: boolean;
}

/** "blocks-iam" reads as "iam": every built-in service carries the same prefix. */
export const serviceLabel = (service?: string | null): string =>
  (service ?? "").replace(/^blocks-/, "");

const labelOf = (items: { label: string; value: number }[], value?: number) =>
  items.find((x) => x.value === value)?.label;

const describeDeleteError = (error: unknown): string => {
  if (isErrorWithErrors(error)) {
    const message = getErrorMessage(error.errors, NOTIFICATION_CONFIG_ERROR_MESSAGES);
    return Array.isArray(message) ? message.join(" ") : message;
  }
  return JSON.stringify(error);
};

const IMPORTANCE_VARIANTS = {
  1: "secondary",
  2: "warning",
  3: "error",
} as const;

export const distinctServices = (rows: INotificationConfigRow[] = []): string[] =>
  Array.from(new Set(rows.map((row) => row.sourceService).filter((x): x is string => !!x))).sort(
    (a, b) => a.localeCompare(b),
  );

/** Importance and service are filtered over the loaded rows: the list API has no such filter. */
export const filterConfigRows = (
  rows: INotificationConfigRow[],
  importance: string,
  service: string,
): INotificationConfigRow[] =>
  rows.filter(
    (row) =>
      (!importance || String(row.importance ?? 0) === importance) &&
      (!service || row.sourceService === service),
  );

const NotificationConfigurationList: React.FC<NotificationConfigurationListProps> = ({
  isLoading: isLoadingProp,
}) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams, setQueryParams } = useNotificationConfigsFilterQueryParams();
  const { data, isLoading, isFetching } = useGetNotificationConfigs({
    projectKey: tenantId,
    page: queryParams.notificationPage,
    pageSize: queryParams.notificationPageSize,
    searchText: queryParams.notificationSearch || undefined,
  });
  const loading = isLoadingProp ?? (isLoading || isFetching);
  const visibleRows = filterConfigRows(
    data?.configurations ?? [],
    queryParams.notificationImportance,
    queryParams.notificationService,
  );

  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConfigData, setSelectedConfigData] = useState<INotificationConfigRow | null>(null);

  const { isPending: isDeletePending, mutateAsync: deleteNotificationConfig } =
    useDeleteNotificationConfig();

  const onPageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, notificationPage: page }));
  };

  const onEditNotificationConfig = (rowData: INotificationConfigRow) => {
    setSelectedConfigData(rowData);
    setIsEditOpen(true);
  };

  const onDeleteNotificationConfig = (rowData: INotificationConfigRow) => {
    setSelectedConfigData(rowData);
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDeleteConfig = async () => {
    if (!selectedConfigData?.itemId) return;
    try {
      await deleteNotificationConfig(selectedConfigData.itemId);
      toast({
        variant: "success",
        title: "Success",
        description: "Notification deleted.",
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: describeDeleteError(error),
      });
    }
  };

  return (
    <>
      <ConfigsTableShell
        footer={
          <Pagination
            page={queryParams.notificationPage}
            pageSize={queryParams.notificationPageSize}
            totalCount={data?.totalCount ?? 0}
            pageSizeOptions={[queryParams.notificationPageSize]}
            onChange={onPageChangeHandler}
          />
        }
      >
        {loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-6 w-full rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-medium-emphasis">
                    No configurations match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {visibleRows.map((config) => (
                <TableRow key={config.itemId}>
                  <TableCell className="max-w-[420px]">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{config.name}</span>
                      {config.isBuiltIn && (
                        <Badge variant="info" className="w-fit shrink-0 px-1.5 py-0">
                          Built-in
                        </Badge>
                      )}
                    </div>
                    {config.description && (
                      <div
                        className="truncate text-xs text-medium-emphasis"
                        title={config.description}
                      >
                        {config.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {config.importance ? (
                      <Badge
                        className="w-fit px-1.5 py-0"
                        variant={
                          IMPORTANCE_VARIANTS[
                            config.importance as keyof typeof IMPORTANCE_VARIANTS
                          ] ?? "outline"
                        }
                      >
                        {labelOf(notificationImportances, config.importance)}
                      </Badge>
                    ) : (
                      <span className="text-low-emphasis">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {config.kind ? (
                      labelOf(notificationKinds, config.kind)
                    ) : (
                      <span className="text-low-emphasis">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {config.sourceService ? (
                      serviceLabel(config.sourceService)
                    ) : (
                      <span className="text-low-emphasis">—</span>
                    )}
                  </TableCell>
                  <TableCell>{labelOf(notificationTypes, config.notificationType)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          config.isDisabled ? "bg-low-emphasis" : "bg-success"
                        }`}
                      />
                      {config.isDisabled ? "Off" : "On"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-5 w-5 p-0">
                          <EllipsisVertical width={20} height={20} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditNotificationConfig(config);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotificationConfig(config);
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ConfigsTableShell>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        {!loading && selectedConfigData && (
          <ConfirmationModal
            onCancel={() => setIsDeleteDialogOpen(false)}
            onConfirm={() => onConfirmDeleteConfig()}
            data={{
              dialogTitle: "Delete notification?",
              dialogSubtitle: `"${selectedConfigData?.name}" will be deleted.`,
            }}
            buttonState={{ confirm: { disable: isDeletePending } }}
          />
        )}
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {selectedConfigData && (
          <NewNotificationConfiguration
            key={`${selectedConfigData.itemId}-${isEditOpen}`}
            dialogTitle="Edit notification"
            previousData={selectedConfigData}
            isEdit={true}
            onClose={setIsEditOpen}
          />
        )}
      </Dialog>
    </>
  );
};

export default NotificationConfigurationList;

export function NotificationConfigurationListPage() {
  const [addOpen, setAddOpen] = useQueryState(
    "notificationConfig",
    parseAsBoolean.withDefault(false),
  );
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams } = useNotificationConfigsFilterQueryParams();
  const { data, isLoading, isFetching } = useGetNotificationConfigs({
    projectKey: tenantId,
    page: queryParams.notificationPage,
    pageSize: queryParams.notificationPageSize,
    searchText: queryParams.notificationSearch || undefined,
  });
  const loading = isLoading || isFetching;
  const configurations = data?.configurations ?? [];
  const hasFilters =
    !!queryParams.notificationSearch ||
    !!queryParams.notificationImportance ||
    !!queryParams.notificationService;
  const isEmpty = !loading && configurations.length === 0 && !hasFilters;
  const serviceOptions = distinctServices(configurations);

  return (
    <div className="flex flex-col gap-4">
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <NewNotificationConfiguration
          key={addOpen ? "open" : "closed"}
          dialogTitle="Add notification"
          onClose={() => setAddOpen(false)}
          isEdit={false}
        />
      </Dialog>
      {isEmpty ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Use Add Configuration to create one."
        />
      ) : (
        <>
          <NotificationConfigsFilterToolBar serviceOptions={serviceOptions} />
          <NotificationConfigurationList isLoading={loading} />
        </>
      )}
    </div>
  );
}
