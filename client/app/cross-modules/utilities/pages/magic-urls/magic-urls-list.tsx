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
import { Pencil, Trash2 } from "lucide-react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { ConfigureMagicUrlModal } from "@blocks-utilities/components/magic-url-config-dialog/configure-magic-url-modal";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { useDeleteMagicUrlConfig } from "@blocks-utilities/hooks/use-magic-url-config";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";

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
  const { mutateAsync: deleteConfig, isPending: isDeleting } = useDeleteMagicUrlConfig();
  const [itemToDelete, setItemToDelete] = React.useState<IMagicUrlConfig | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteConfig(itemToDelete.itemId);
      showSuccessToast({ description: "Configuration deleted successfully" });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch {
      showErrorToast({ errors: "Failed to delete configuration" });
    }
  };

  const columns = useMemo<ColumnDef<IMagicUrlConfig>[]>(
    () => [
      {
        accessorKey: "contextName",
        header: "Context Name",
        cell: ({ row }) => (
          <span className="font-medium" title={row.original.contextName}>
            {row.original.contextName || "-"}
          </span>
        ),
      },
      {
        accessorKey: "shortUrlBase",
        header: "Short URL Base",
        cell: ({ row }) => (
          <CopyToClipboardButton textToCopy={row.original.shortUrlBase} isHoverable>
            <span className="truncate font-medium">{row.original.shortUrlBase || "-"}</span>
          </CopyToClipboardButton>
        ),
      },
      {
        accessorKey: "lastUpdatedDate",
        header: "Last Updated",
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
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <ConfigureMagicUrlModal configuration={row.original}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" />
                  <span className="ml-2.5 hidden sm:inline">Edit</span>
                </Button>
              </DialogTrigger>
            </ConfigureMagicUrlModal>
            <Button
              size="sm"
              variant="outline"
              className="text-error"
              disabled={isDeleting}
              onClick={() => {
                setItemToDelete(row.original);
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2.5 hidden sm:inline">Delete</span>
            </Button>
          </div>
        ),
      },
    ],
    [isDeleting],
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No configurations found. Use Add Configuration to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <ConfirmationModal
          onCancel={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDelete}
          data={{
            dialogTitle: "Delete Magic URL Configuration",
            dialogSubtitle: `Are you sure you want to delete "${itemToDelete?.contextName ?? "this configuration"}"?`,
            confirmButton: "Delete",
            cancelButton: "Cancel",
          }}
          buttonState={{ confirm: { disable: isDeleting } }}
        />
      </Dialog>
    </>
  );
}
