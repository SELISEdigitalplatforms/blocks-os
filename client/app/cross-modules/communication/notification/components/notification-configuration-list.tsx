import React, { useEffect, useState } from "react";
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
import { Bell } from "lucide-react";
import { NOTIFICATION_CONFIG_ERROR_MESSAGES } from "../constants/notification.constant";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";
import { matchesReceivers, matchesSendTo } from "../utils/notification-labels";
import { NotificationConfigRow } from "./notification-config-row";
import { NotificationConfigPage } from "./notification-config-page";
import { PushDevicesPage } from "./push-devices-page";
import { PushSettingsPage } from "./push-settings-page";
import { RecipientsHeader } from "./recipients-header";
import { getErrorMessage, isErrorWithErrors } from "@/lib/error";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { toast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  NotificationConfigsFilterToolBar,
  useNotificationConfigsFilterQueryParams,
} from "./notification-configs-filter-toolbar";
import {
  useNotificationNavigation,
  useNotificationView,
} from "../hooks/use-notification-navigation";

const columns: { key: string; label: React.ReactNode }[] = [
  { key: "name", label: NOTIFICATION_TEXT.columns.name },
  { key: "recipients", label: <RecipientsHeader /> },
  { key: "service", label: NOTIFICATION_TEXT.columns.service },
  { key: "importance", label: NOTIFICATION_TEXT.columns.importance },
  { key: "delivery", label: NOTIFICATION_TEXT.columns.delivery },
  { key: "status", label: NOTIFICATION_TEXT.columns.status },
  { key: "actions", label: "" },
];

const SKELETON_ROWS = ["s1", "s2", "s3", "s4", "s5"];

interface NotificationConfigurationListProps {
  isLoading?: boolean;
  /** Opens the edit page of a notification. */
  onEdit: (itemId: string) => void;
}

const describeDeleteError = (error: unknown): string => {
  if (isErrorWithErrors(error)) {
    const message = getErrorMessage(error.errors, NOTIFICATION_CONFIG_ERROR_MESSAGES);
    return Array.isArray(message) ? message.join(" ") : message;
  }
  return JSON.stringify(error);
};

/** Importance, audience and recipients are filtered over the loaded rows: the list API has no such filter. */
export const filterConfigRows = (
  rows: INotificationConfigRow[],
  importance: string,
  sendTo = "",
  receivers = "",
): INotificationConfigRow[] =>
  rows.filter(
    (row) =>
      (!importance || String(row.importance ?? 0) === importance) &&
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
        toolbar={<NotificationConfigsFilterToolBar />}
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
                    {NOTIFICATION_TEXT.noMatches}
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
  const view = useNotificationView();
  const nav = useNotificationNavigation();
  const { redirectLegacyLink } = nav;
  useEffect(redirectLegacyLink, [redirectLegacyLink]);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams } = useNotificationConfigsFilterQueryParams();
  const { data, isLoading, isFetching } = useGetNotificationConfigs({
    projectKey: tenantId,
    page: queryParams.notificationPage,
    pageSize: queryParams.notificationPageSize,
    searchText: queryParams.notificationSearch || undefined,
  });
  const loading = isLoading || isFetching;
  const hasFilters =
    !!queryParams.notificationSearch ||
    !!queryParams.notificationImportance ||
    !!queryParams.notificationSendTo ||
    !!queryParams.notificationReceivers;
  const isEmpty = !loading && (data?.configurations ?? []).length === 0 && !hasFilters;

  if (view.kind === "devices") return <PushDevicesPage onBack={nav.openPush} />;
  if (view.kind === "push") {
    return <PushSettingsPage onClose={nav.openList} onViewDevices={nav.openDevices} />;
  }
  if (view.kind === "new" || view.kind === "edit") {
    return (
      <NotificationConfigPage
        itemId={view.kind === "edit" ? view.id : ""}
        onClose={nav.openList}
        onSetUpPush={nav.openPush}
      />
    );
  }

  // Add Configuration and Push live in the page header, like the other Secrets & Configs pages.
  return isEmpty ? (
    <EmptyState
      icon={Bell}
      title="No notifications yet"
      description="Use Add notification to create one."
    />
  ) : (
    <NotificationConfigurationList isLoading={loading} onEdit={nav.openEdit} />
  );
}
