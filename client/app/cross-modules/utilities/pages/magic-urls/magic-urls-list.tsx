import React, { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { formatDate, parseDateString } from "@/lib/utils";
import { IMagicUrlConfig } from "@blocks-utilities/models/magic-url-config.model";
import { Button } from "@/components/ui-kits/button/button";
import { EllipsisVertical, Pencil, Trash } from "lucide-react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { useDeleteMagicUrlConfig } from "@blocks-utilities/hooks/use-magic-url-config";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useT } from "@seliseblocks/genesis-os";

const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);

type MagicUrlsListProps = {
  configurations: IMagicUrlConfig[];
  isLoading: boolean;
};

export function MagicUrlsList({ configurations, isLoading }: MagicUrlsListProps) {
  const { t } = useT("os.utilities");
  const { mutateAsync: deleteConfig, isPending: isDeleting } = useDeleteMagicUrlConfig();
  const [itemToDelete, setItemToDelete] = React.useState<IMagicUrlConfig | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [selectedConfig, setSelectedConfig] = React.useState<IMagicUrlConfig | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const handleEditConfig = (config: IMagicUrlConfig) => {
    setSelectedConfig(config);
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteConfig(itemToDelete.itemId);
      showSuccessToast({ description: t("MAGIC_URLS_LIST.CONFIGURATION_DELETED_SUCCESSFULLY") });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch {
      showErrorToast({ errors: t("MAGIC_URLS_LIST.FAILED_TO_DELETE_CONFIGURATION") });
    }
  };

  const columns = useMemo<ColumnDef<IMagicUrlConfig>[]>(
    () => [
      {
        accessorKey: "contextName",
        header: t("MAGIC_URLS_LIST.CONTEXT_NAME"),
        cell: ({ row }) => (
          <span className="font-medium" title={row.original.contextName}>
            {row.original.contextName || "-"}
          </span>
        ),
      },
      {
        accessorKey: "shortUrlBase",
        header: t("MAGIC_URLS_LIST.SHORT_URL_BASE"),
        cell: ({ row }) => (
          <CopyToClipboardButton textToCopy={row.original.shortUrlBase} isHoverable>
            <span className="truncate font-medium">{row.original.shortUrlBase || "-"}</span>
          </CopyToClipboardButton>
        ),
      },
      {
        accessorKey: "lastUpdatedDate",
        header: t("MAGIC_URLS_LIST.LAST_UPDATED"),
        cell: ({ row }) => {
          const dateStr = row.original.lastUpdatedDate || row.original.createdDate;
          if (!dateStr) return <span>-</span>;
          return <span>{formatDate(parseDateString(dateStr))}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
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
                    handleEditConfig(row.original);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  <span>{t("common:EDIT")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-error"
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    setItemToDelete(row.original);
                    setIsDeleteModalOpen(true);
                  }}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>{t("common:DELETE")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [isDeleting, t],
  );

  const table = useReactTable({
    data: configurations,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <LoadingSkelton />;

  return (
    <>
      <ScrollArea className="w-full">
        <Table className="text-sm">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="px-4 py-2 hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-bold text-medium-emphasis">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="text-medium-emphasis"
                isHoverable
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {selectedConfig && (
        <ConfigureMagicUrlModal
          configuration={selectedConfig}
          open={isEditOpen}
          onOpenChange={(value) => {
            setIsEditOpen(value);
            if (!value) setSelectedConfig(null);
          }}
        />
      )}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <ConfirmationModal
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          data={{
            dialogTitle: t("MAGIC_URLS_LIST.DELETE_MAGIC_URL_CONFIGURATION"),
            dialogSubtitle: t("MAGIC_URLS_LIST.ARE_YOU_SURE_YOU_WANT", {
              contextName: itemToDelete?.contextName ?? "this configuration",
            }),
            confirmButton: t("common:DELETE"),
            cancelButton: t("common:CANCEL"),
          }}
          buttonState={{ confirm: { disable: isDeleting } }}
        />
      </Dialog>
    </>
  );
}
