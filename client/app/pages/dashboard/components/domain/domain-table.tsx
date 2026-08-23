import { useUpdateProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { IDomain } from "@seliseblocks/genesis-os/models";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Settings, ShieldCheck, Trash2 } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { FilterControls } from "@/components/filter-toolbar";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { DASHBOARD_TABLE_PAGE_SIZE } from "../dashboard.constant";
import { DomainFormDialog } from "./domain-form-dialog";
import { DomainAction } from "./domain.constant";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { CnameValidatorDialog } from "../cname/dialog";
import {
  Button,
  CopyToClipboardButton,
  RenderConditionally,
} from "@seliseblocks/genesis-os/components";
import { DomainDeleteDialog } from "./domain-delete-dialog";

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ verified }: { verified: boolean }) =>
  verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      Unverified
    </span>
  );

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<IDomain>();

const CopyableDomainValue = ({ value, muted = false }: { value: string; muted?: boolean }) => (
  <CopyToClipboardButton textToCopy={value} isHoverable className="min-w-0">
    <span
      className={cn("break-all text-sm", muted ? "text-muted-foreground" : "text-high-emphasis")}
    >
      {value}
    </span>
  </CopyToClipboardButton>
);

const buildColumns = (
  onEdit: (domain: IDomain) => void,
  onDeleteRequest: (domain: IDomain) => void,
  onCname: (domain: IDomain) => void,
) => [
  columnHelper.accessor("domain", {
    header: "Domain",
    cell: (info) => <CopyableDomainValue value={info.getValue()} />,
  }),
  columnHelper.accessor("isDomainVerified", {
    header: "DNS Status",
    cell: (info) => <StatusBadge verified={info.getValue()} />,
  }),
  columnHelper.accessor("cookieDomain", {
    header: "Cookie Domain",
    cell: (info) => <CopyableDomainValue value={info.getValue()} muted />,
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const domain = row.original;
      return (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Delete domain"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDeleteRequest(domain)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Configure + CNAME lookup — only for unverified domains */}
          <RenderConditionally condition={!domain.isDomainVerified}>
            <Button
              variant="ghost"
              size="icon"
              title="Configure domain"
              onClick={() => onEdit(domain)}
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Validate CNAME"
              onClick={() => onCname(domain)}
            >
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </Button>
          </RenderConditionally>
        </div>
      );
    },
  }),
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DomainTableProps {
  data: IDomain[];
}

export const DomainTable = ({ data }: DomainTableProps) => {
  const { mutateAsync, isPending } = useUpdateProject();
  const [search, setSearch] = useState("");

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<IDomain | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (domain: IDomain) => {
    setEditTarget(domain);
    setEditDialogOpen(true);
  };

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<IDomain | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteRequest = (domain: IDomain) => {
    setDeleteTarget(domain);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (deleteSharedApiHost: boolean) => {
    if (!deleteTarget) return;
    try {
      const res = await mutateAsync({
        action: DomainAction.Delete,
        application: deleteTarget,
        applicationDomain: deleteTarget.domain,
        deleteSharedApiHost,
      });
      if (res.isSuccess) {
        showSuccessToast({ description: "Domain deleted successfully" });
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch {
      showErrorToast({ errors: "Failed to delete domain" });
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // ── CNAME dialog ───────────────────────────────────────────────────────────
  const [cnameTarget, setCnameTarget] = useState<IDomain | null>(null);
  const [cnameDialogOpen, setCnameDialogOpen] = useState(false);

  const handleCname = (domain: IDomain) => {
    setCnameTarget(domain);
    setCnameDialogOpen(true);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = buildColumns(handleEdit, handleDeleteRequest, handleCname);
  const filteredData = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return data.filter((domain) => domain.domain.toLowerCase().includes(normalizedSearch));
  }, [data, search]);
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: DASHBOARD_TABLE_PAGE_SIZE } },
    // A data change otherwise queues a reset of the page index back to the first page.
    // That reset would race the clamp below and win, throwing a reader back to page 1 on
    // every background refetch, so the index is kept and corrected explicitly instead.
    autoResetPageIndex: false,
  });

  const { pageIndex } = table.getState().pagination;
  const lastPageIndex = Math.max(0, table.getPageCount() - 1);

  // Deleting the last row of the last page leaves the index past the end of the data,
  // which renders an empty table body. Clamp in a layout effect so that blank frame is
  // never painted.
  useLayoutEffect(() => {
    if (pageIndex > lastPageIndex) table.setPageIndex(lastPageIndex);
  }, [pageIndex, lastPageIndex, table]);

  const handleSearchChange = (value: string) => {
    table.setPageIndex(0);
    setSearch(value);
  };

  return (
    <>
      {/* Edit dialog — one instance, target swaps per row */}
      <DomainFormDialog
        open={editDialogOpen}
        application={editTarget}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditTarget(null);
        }}
      />

      {/* Delete confirmation — one instance, target swaps per row */}
      <DomainDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        domain={deleteTarget}
        isPending={isPending}
        onConfirm={handleDeleteConfirm}
      />

      {/* CNAME validator dialog — one instance, target swaps per row.
          Re-resolve the target from `data` so the open dialog reflects the
          refetched verification status instead of a stale click-time snapshot */}
      <CnameValidatorDialog
        open={cnameDialogOpen}
        domain={(cnameTarget && data.find((d) => d.domain === cnameTarget.domain)) || cnameTarget}
        onOpenChange={(open) => {
          setCnameDialogOpen(open);
          if (!open) setCnameTarget(null);
        }}
      />

      {data.length > 0 && (
        <div className="mb-4 flex justify-start">
          <FilterControls.SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search domains..."
            className="w-64"
          />
        </div>
      )}

      {/* Table — min width keeps columns readable and scrolls horizontally
          on narrow screens, matching the repo table's behavior */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "h-12 px-4 text-left text-xs font-semibold uppercase tracking-wide text-medium-emphasis",
                      header.id === "actions" && "w-32",
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {data.length === 0
                    ? "No domains configured yet."
                    : "No domains match your search."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-2 md:px-4 md:py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — omitted entirely when there is nothing to page through, so the
          empty state is not captioned "Page 1 of 1". No page-size selector: the size is
          fixed at five. */}
      {filteredData.length > 0 && (
        <nav aria-label="Domains pagination" className="mt-4 flex items-center md:justify-end">
          <Pagination
            page={pageIndex}
            pageSize={DASHBOARD_TABLE_PAGE_SIZE}
            totalCount={filteredData.length}
            onChange={(nextPageIndex) => table.setPageIndex(nextPageIndex)}
          />
        </nav>
      )}
    </>
  );
};
