import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useDeleteRole } from "@blocks-idp/iam/hooks/use-roles";
import { ArchiveAction } from "@blocks-idp/iam/components/archive-action";
import { Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { UpdateRole } from "../update-role/update-role";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { IRole } from "@blocks-idp/iam/models/role";
import { FilterControls, SortValue } from "@/components/filter-toolbar";
import { useRolesSortQueryParams } from "./roles-filter-toolbar";
type RolesTableProps = {
  roles: IRole[];
  isLoading: boolean;
  /**
   * Whether to mark roles that came from the default organization. Only meaningful in a
   * multi-organization tenant -- with one organization every role is local and the badge would
   * label every row. Pairs with the row actions below, which already hide the archive action for
   * a default-derived copy because the backend refuses to archive one directly.
   */
  showDefaultOriginBadge?: boolean;
};
const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);
/**
 * Actions for one role row.
 *
 * The archive mutation is instantiated here rather than in the list so `isPending` is scoped to
 * this row; a single hoisted hook would disable every other row's confirm button.
 *
 * stopPropagation sits on the wrapper, not just the buttons: the row navigates on click, and
 * React events bubble through the component tree even though the dialog renders in a portal --
 * so Cancel, Confirm and the overlay would otherwise navigate away too.
 */
const RoleRowActions = ({ row, onEdit }: { row: IRole; onEdit: (role: IRole) => void }) => {
  const { mutateAsync, isPending } = useDeleteRole();

  return (
    <div
      className="flex"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        size="icon"
        className="rounded-full"
        variant="ghost"
        aria-label={`Edit role ${row.name}`}
        onClick={() => onEdit(row)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      {!row.createdFromDefault && (
        <ArchiveAction
          entity="role"
          name={row.name}
          itemId={row.itemId}
          archive={mutateAsync}
          isPending={isPending}
        />
      )}
    </div>
  );
};

export const RolesList = ({
  roles,
  isLoading,
  showDefaultOriginBadge = false,
}: RolesTableProps) => {
  const { sortQueryParams, setSortQueryParams } = useRolesSortQueryParams();
  const [selectedRole, setSelectedRole] = useState<IRole | null>(null);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const sortHandler = useCallback(
    (value: SortValue) => {
      setSortQueryParams(value);
    },
    [setSortQueryParams],
  );
  const columns = useMemo<ColumnDef<IRole>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => `${row.name}`.trim(),
        header: () => (
          <FilterControls.SortHeader
            id="Name"
            label="Name"
            value={sortQueryParams}
            onChange={sortHandler}
          />
        ),
        cell: (roles) => (
          <div className="flex w-[130px] items-center gap-1.5">
            <span className="truncate">{roles.row.original.name}</span>
            {showDefaultOriginBadge && roles.row.original.createdFromDefault && (
              <Badge variant="secondary" className="shrink-0 font-normal">
                Default
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "slug",
        accessorFn: (row) => `${row.slug}`.trim(),
        header: () => (
          <FilterControls.SortHeader
            id="Slug"
            label="Slug"
            value={sortQueryParams}
            onChange={sortHandler}
          />
        ),
        cell: (roles) => (
          <div className="w-[150px] truncate">
            <span className="rounded-sm bg-blocks-primary-shades-300 px-2 py-1">
              {roles.row.original.slug}
            </span>
          </div>
        ),
      },
      {
        id: "count",
        accessorFn: (row) => `${row.count}`.trim(),
        header: () => (
          <FilterControls.SortHeader
            id="Count"
            label="Permissions"
            value={sortQueryParams}
            onChange={sortHandler}
          />
        ),
        cell: (roles) => <div className="w-[180px] truncate">{roles.row.original.count}</div>,
      },
      {
        id: "description",
        accessorFn: (row) => `${row.description}`.trim(),
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Description</span>
          </div>
        ),
        cell: (roles) => (
          <div className="w-[200px] truncate md:w-[260px]">{roles.row.original.description}</div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => <RoleRowActions row={row.original} onEdit={setSelectedRole} />,
      },
    ],
    [sortHandler, sortQueryParams, showDefaultOriginBadge],
  );
  const table = useReactTable({
    data: roles,
    columns,
    // Row identity by itemId rather than the default array index, so the React key on each
    // TableRow tracks the role and not the position. Measured: an open Archive dialog closes when
    // the data changes either way, so this is not fixing a live wrong-row bug -- it is the
    // correct identity for anything TanStack keys per row.
    getRowId: (row) => row.itemId,
    getCoreRowModel: getCoreRowModel(),
  });
  const onRowClickHandler = (itemId: number | string) => {
    navigate(scoped(`iam/role-detail/${itemId}`));
  };
  if (isLoading) return <LoadingSkelton />;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="px-4 py-3 hover:bg-transparent">
            {table
              .getHeaderGroups()
              .map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )),
              )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!roles.length ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No roles found. Please create new roles.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => onRowClickHandler(row.original.itemId)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {selectedRole && (
        <Dialog
          open={!!selectedRole}
          onOpenChange={(value) => {
            if (!value) setSelectedRole(null);
          }}
        >
          <UpdateRole
            role={selectedRole}
            isOpen={!!selectedRole}
            onClose={() => setSelectedRole(null)}
          />
        </Dialog>
      )}
    </>
  );
};
