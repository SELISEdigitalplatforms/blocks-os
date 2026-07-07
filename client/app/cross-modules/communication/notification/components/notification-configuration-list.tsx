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
  notificationTypes,
} from "../constants/notification.constant";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import {
  NotificationConfigsFilterToolBar,
  useNotificationConfigsFilterQueryParams,
} from "./notification-configs-filter-toolbar";
import { useQueryState, parseAsBoolean } from "nuqs";

const columns = [
  { key: "name", label: "Name" },
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

const NotificationConfigurationList: React.FC<
  NotificationConfigurationListProps
> = ({
  addConfigOpen,
  onAddConfigOpenChange,
  isLoading: isLoadingProp,
  configurationsLength: configurationsLengthProp,
}) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { queryParams, setQueryParams } =
    useNotificationConfigsFilterQueryParams();
  const { data, isLoading, isFetching } = useGetNotificationConfigs({
    projectKey: tenantId,
    page: queryParams.notificationPage,
    pageSize: queryParams.notificationPageSize,
    searchText: queryParams.notificationSearch || undefined,
  });
  const loading = isLoadingProp ?? (isLoading || isFetching);
  const configurationsLength =
    configurationsLengthProp ?? data?.configurations?.length ?? 0;

  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedConfigData, setSelectedConfigData] =
    useState<INotificationConfigRow | null>(null);
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
        description: JSON.stringify(error),
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
        title="Configurations"
        toolbar={<NotificationConfigsFilterToolBar />}
        footer={
          <Pagination
            page={queryParams.notificationPage}
            pageSize={queryParams.notificationPageSize}
            totalCount={data?.totalCount ?? 0}
            pageSizeOptions={[queryParams.notificationPageSize]}
            onChange={onPageChangeHandler}
          />
        }>
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
              {data?.configurations?.map((config) => (
                <TableRow key={config.itemId}>
                  <TableCell>{config.name}</TableCell>
                  <TableCell>
                    {
                      channelsToNotify.find(
                        (x) => x.value === config.channelToNotify,
                      )?.label
                    }
                  </TableCell>
                  <TableCell>
                    {
                      notificationTypes.find(
                        (x) => x.value === config.notificationType,
                      )?.label
                    }
                  </TableCell>
                  <TableCell>
                    {config.enablePersistence ? "Yes" : "No"}
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
                          }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotificationConfig(config);
                          }}>
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

  return (
    <>
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
