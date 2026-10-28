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
import { Bell, Plus, Smartphone } from "lucide-react";
import { NOTIFICATION_CONFIG_ERROR_MESSAGES } from "../constants/notification.constant";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";
import { matchesReceivers, matchesSendTo } from "../utils/notification-labels";
import { NotificationConfigRow } from "./notification-config-row";
import { NotificationConfigPage } from "./notification-config-page";
import { PushSettingsPage } from "./push-settings-page";
import { getErrorMessage, isErrorWithErrors } from "@/lib/error";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { toast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  NotificationConfigsFilterToolBar,
  useNotificationConfigsFilterQueryParams,
} from "./notification-configs-filter-toolbar";
import { useQueryState, parseAsBoolean, parseAsString } from "nuqs";

const columns = [
  { key: "name", label: NOTIFICATION_TEXT.columns.name },
  { key: "sendTo", label: NOTIFICATION_TEXT.columns.sendTo },
  { key: "receivers", label: NOTIFICATION_TEXT.columns.receivers },
  { key: "inApp", label: NOTIFICATION_TEXT.columns.inApp },
  { key: "push", label: NOTIFICATION_TEXT.columns.push },
  { key: "inbox", label: NOTIFICATION_TEXT.columns.inbox },
  { key: "status", label: NOTIFICATION_TEXT.columns.status },
  { key: "actions", label: "" },
];

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5"];

interface NotificationConfigurationListProps {
  isLoading?: boolean;
  /** Opens the edit page of a notification. */
  onEdit: (itemId: string) => void;
}

/** "blocks-iam" reads as "iam": every built-in service carries the same prefix. */
export const serviceLabel = (service?: string | null): string =>
  (service ?? "").replace(/^blocks-/, "");

const describeDeleteError = (error: unknown): string => {
  if (isErrorWithErrors(error)) {
    const message = getErrorMessage(error.errors, NOTIFICATION_CONFIG_ERROR_MESSAGES);
    return Array.isArray(message) ? message.join(" ") : message;
  }
  return JSON.stringify(error);
};

export const distinctServices = (rows: INotificationConfigRow[] = []): string[] =>
  Array.from(new Set(rows.map((row) => row.sourceService).filter((x): x is string => !!x))).sort(
    (a, b) => a.localeCompare(b),
  );

/** Importance and service are filtered over the loaded rows: the list API has no such filter. */
export const filterConfigRows = (
  rows: INotificationConfigRow[],
  importance: string,
  service: string,
  sendTo = "",
  receivers = "",
): INotificationConfigRow[] =>
  rows.filter(
    (row) =>
      (!importance || String(row.importance ?? 0) === importance) &&
      (!service || row.sourceService === service) &&
      matchesSendTo(row, sendTo) &&
      matchesReceivers(row, receivers),
  );

const NotificationConfigurationList: React.FC<NotificationConfigurationListProps> = ({
  isLoading: isLoadingProp,
  onEdit,
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
    queryParams.notificationSendTo,
    queryParams.notificationReceivers,
  );

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConfigData, setSelectedConfigData] = useState<INotificationConfigRow | null>(null);

  const { isPending: isDeletePending, mutateAsync: deleteNotificationConfig } =
    useDeleteNotificationConfig();

  const onPageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, notificationPage: page }));
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
                <NotificationConfigRow
                  key={config.itemId}
                  config={config}
                  onEdit={(row) => onEdit(row.itemId)}
                  onDelete={onDeleteNotificationConfig}
                />
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
    </>
  );
};

export default NotificationConfigurationList;

export function NotificationConfigurationListPage() {
  const [addOpen, setAddOpen] = useQueryState(
    "notificationConfig",
    parseAsBoolean.withDefault(false),
  );
  const [editId, setEditId] = useQueryState("notificationEdit", parseAsString.withDefault(""));
  const [pushOpen, setPushOpen] = useQueryState(
    "notificationPush",
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
    !!queryParams.notificationService ||
    !!queryParams.notificationSendTo ||
    !!queryParams.notificationReceivers;
  const isEmpty = !loading && configurations.length === 0 && !hasFilters;
  const serviceOptions = distinctServices(configurations);

  const backToList = () => {
    setAddOpen(false);
    setEditId("");
    setPushOpen(false);
  };

  if (pushOpen) return <PushSettingsPage onClose={backToList} />;
  if (addOpen || editId) {
    return (
      <NotificationConfigPage
        itemId={editId}
        onClose={backToList}
        onSetUpPush={() => {
          setAddOpen(false);
          setEditId("");
          setPushOpen(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isEmpty ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Use Add Configuration to create one."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-medium-emphasis">{NOTIFICATION_TEXT.listSubtitle}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPushOpen(true)}>
                <Smartphone className="mr-2 h-4 w-4" />
                <span>{NOTIFICATION_TEXT.mobilePush}</span>
              </Button>
              <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                <span>{NOTIFICATION_TEXT.newNotification}</span>
              </Button>
            </div>
          </div>
          <NotificationConfigsFilterToolBar serviceOptions={serviceOptions} />
          <NotificationConfigurationList isLoading={loading} onEdit={setEditId} />
        </>
      )}
    </div>
  );
}
