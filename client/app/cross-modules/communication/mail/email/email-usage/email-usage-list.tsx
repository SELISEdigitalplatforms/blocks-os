import React, { useMemo } from "react";
import { ColumnDef, getCoreRowModel, useReactTable, flexRender } from "@tanstack/react-table";
import { Eye, Inbox, MoreVertical, Send } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { cn } from "@/lib/utils";
import { useGetEmailUsage } from "@blocks-communication/mail/hooks/use-email-usage";
import { StatusBadge } from "@blocks-communication/mail/email/email-usage/status-badge";
import { IEmailUsage } from "@blocks-communication/mail/models/email";
import {
  EmailUsageFilterToolbar,
  useEmailUsageFilterQueryParams,
} from "@blocks-communication/mail/email/email-usage/email-usage-filter-toolbar";
import {
  formatMailDate,
  formatMailDateLong,
  getAvatarTone,
  getInitials,
  parseAddress,
  parseAddressList,
  toPreview,
} from "@blocks-communication/mail/email/email-usage/mail-display";
import { MailAvatar } from "@blocks-communication/mail/email/email-usage/mail-avatar";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

const LoadingSkeleton = () => (
  <div className="grid w-full gap-1" data-testid="mail-list-skeleton">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 px-2 py-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3.5 w-1/4 rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
        <Skeleton className="h-3 w-12 rounded" />
      </div>
    ))}
  </div>
);

/** Width and visibility per column id, applied to both the header and the cells. */
const COLUMN_CLASS: Record<string, string | undefined> = {
  counterparty: "w-[26%]",
  mailbox: "hidden w-[20%] xl:table-cell",
  status: "w-32",
  date: "w-32 text-right",
  actions: "w-12",
};

/** An address cell: avatar, display name, and the address underneath when they differ. */
const AddressCell = ({ raw, withAvatar }: { raw: string; withAvatar?: boolean }) => {
  const addresses = parseAddressList(raw);
  const primary = addresses[0] ?? parseAddress(raw);
  const extra = addresses.length - 1;
  if (!primary.email) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex min-w-0 items-center gap-3" title={raw}>
      {withAvatar && (
        <MailAvatar initials={getInitials(primary)} tone={getAvatarTone(primary.email)} />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-high-emphasis">
          {primary.name}
          {extra > 0 && (
            <span className="ml-1 font-normal text-muted-foreground">+{extra}</span>
          )}
        </p>
        {primary.name !== primary.email && (
          <p className="truncate text-xs text-muted-foreground">{primary.email}</p>
        )}
      </div>
    </div>
  );
};

export const EmailUsageList = ({ isInbound }: { isInbound: boolean }) => {
  const scoped = useScopedPath();
  const navigate = useNavigate();
  const { queryParams, setQueryParams } = useEmailUsageFilterQueryParams();
  const { page, pageSize, search, status, startDate, endDate } = queryParams;
  const { data, isLoading } = useGetEmailUsage(
    page,
    pageSize,
    isInbound,
    search,
    status,
    startDate,
    endDate,
  );

  const detailsPath = (mail: IEmailUsage) =>
    scoped(`email-management/usage/${encodeURIComponent(mail.messageId)}`);

  const columns = useMemo<ColumnDef<IEmailUsage>[]>(() => {
    const allColumns: ColumnDef<IEmailUsage>[] = [
      {
        id: "counterparty",
        accessorKey: isInbound ? "from" : "to",
        header: isInbound ? "From" : "To",
        cell: ({ row }) => (
          <AddressCell raw={isInbound ? row.original.from : row.original.to} withAvatar />
        ),
      },
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => {
          const preview = toPreview(row.original.body);
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-high-emphasis">
                {row.original.subject || <span className="italic text-muted-foreground">(no subject)</span>}
              </p>
              {preview && <p className="truncate text-xs text-muted-foreground">{preview}</p>}
            </div>
          );
        },
      },
      {
        id: "mailbox",
        accessorKey: isInbound ? "to" : "from",
        header: isInbound ? "Mailbox" : "From",
        cell: ({ row }) => {
          const raw = isInbound ? row.original.to : row.original.from;
          const [first, ...rest] = parseAddressList(raw);
          return (
            <span className="block truncate text-sm text-muted-foreground" title={raw}>
              {first?.email || "-"}
              {rest.length > 0 && ` +${rest.length}`}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
      },
      {
        accessorKey: "date",
        header: isInbound ? "Received Date" : "Send Date",
        cell: ({ row }) => {
          const dateValue = row.original.date;
          if (!dateValue) return <span className="text-muted-foreground">-</span>;
          return (
            <span
              className="block whitespace-nowrap text-right text-sm text-muted-foreground"
              title={formatMailDateLong(dateValue)}
            >
              {formatMailDate(dateValue)}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => navigate(detailsPath(row.original))}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ];
    // An inbound mail's status is always "Received", so the column says nothing.
    return isInbound ? allColumns.filter((col) => col.header !== "Status") : allColumns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInbound, scoped, navigate]);

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalCount = data?.totalCount ?? 0;
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = Math.min(totalCount, (page + 1) * pageSize);
  const EmptyIcon = isInbound ? Inbox : Send;

  return (
    <div className="flex flex-col gap-4">
      <EmailUsageFilterToolbar isInbound={isInbound} />
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="overflow-hidden rounded-md border">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const columnClass = COLUMN_CLASS[header.column.id];
                      return (
                        <TableHead
                          key={header.id}
                          className={cn("h-10 text-xs font-medium uppercase tracking-wide", columnClass)}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      isHoverable
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ${row.original.subject || "message"}`}
                      className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
                      onClick={() => navigate(detailsPath(row.original))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(detailsPath(row.original));
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const columnClass = COLUMN_CLASS[cell.column.id];
                        return (
                          <TableCell key={cell.id} className={cn("py-3", columnClass)}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-48">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <EmptyIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-high-emphasis">No results.</p>
                        <p className="text-xs text-muted-foreground">
                          {search || status || startDate || endDate
                            ? "No mail matches the current filters."
                            : isInbound
                              ? "Mail received by an inbound configuration will appear here."
                              : "Mail sent through an outbound configuration will appear here."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalCount > 0 && (
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <p className="text-xs text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {totalCount}
              </p>
              {totalCount > pageSize && (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={totalCount}
                  pageSizeOptions={[pageSize]}
                  onChange={(page) => setQueryParams({ page })}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
