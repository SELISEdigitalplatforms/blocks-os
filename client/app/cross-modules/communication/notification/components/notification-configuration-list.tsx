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
  channelsToNotify,
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
  { key: "channelToNotify", label: "Channel" },
  { key: "notificationType", label: "Type" },
  { key: "enablePersistence", label: "Persistence" },
  { key: "actions", label: "" },
];

interface NotificationConfigurationListProps {
  addConfigOpen?: boolean;
  onAddConfigOpenChange?: (open: boolean) => void;
  isLoading?: boolean;
  configurationsLength?: number;
}

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
  addConfigOpen,
  onAddConfigOpenChange,
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
  const internalOpen = addConfigOpen ?? false;
  const setOpen = onAddConfigOpenChange ?? (() => {});

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
        description: "Configuration deleted successfully",
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
    <div className="flex flex-col gap-6">
      <Dialog open={internalOpen} onOpenChange={setOpen}>
        <NewNotificationConfiguration
          key={internalOpen ? "open" : "closed"}
          dialogTitle="Add Configuration"
          onClose={setOpen}
          isEdit={false}
        />
      </Dialog>
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
              {Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
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
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{config.name}</span>
                      {config.isBuiltIn && <Badge variant="info">Built-in</Badge>}
                      {config.isDisabled && <Badge variant="outline">Off</Badge>}
                    </div>
                    {config.description && (
                      <div className="text-sm text-medium-emphasis">{config.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {config.importance ? (
                      <Badge
                        variant={
                          IMPORTANCE_VARIANTS[
                            config.importance as keyof typeof IMPORTANCE_VARIANTS
                          ] ?? "outline"
                        }
                      >
                        {notificationImportances.find((x) => x.value === config.importance)?.label}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {config.kind
                      ? notificationKinds.find((x) => x.value === config.kind)?.label
                      : null}
                  </TableCell>
                  <TableCell>{config.sourceService}</TableCell>
                  <TableCell>
                    {channelsToNotify.find((x) => x.value === config.channelToNotify)?.label}
                  </TableCell>
                  <TableCell>
                    {notificationTypes.find((x) => x.value === config.notificationType)?.label}
                  </TableCell>
                  <TableCell>{config.enablePersistence ? "Yes" : "No"}</TableCell>
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
              dialogTitle: "Confirmation",
              dialogSubtitle: `Are you sure you want to delete the ${selectedConfigData?.name} configuration?`,
            }}
            buttonState={{ confirm: { disable: isDeletePending } }}
          />
        )}
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        {selectedConfigData && (
          <NewNotificationConfiguration
            key={`${selectedConfigData.itemId}-${isEditOpen}`}
            dialogTitle="Edit Configuration"
            previousData={selectedConfigData}
            isEdit={true}
            onClose={setIsEditOpen}
          />
        )}
      </Dialog>
    </div>
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
  const isEmpty = !loading && configurations.length === 0;
  const serviceOptions = distinctServices(configurations);

  return (
    <>
      <NotificationConfigsFilterToolBar serviceOptions={serviceOptions} />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <NewNotificationConfiguration
          key={addOpen ? "open" : "closed"}
          dialogTitle="Add Configuration"
          onClose={() => setAddOpen(false)}
          isEdit={false}
        />
      </Dialog>
      {isEmpty ? (
        <EmptyState
          icon={Bell}
          title="No notification configurations found"
          description="Use Add Configuration to create one."
        />
      ) : (
        <NotificationConfigurationList
          addConfigOpen={false}
          onAddConfigOpenChange={() => {}}
          isLoading={loading}
          configurationsLength={configurations.length}
        />
      )}
    </>
  );
}
