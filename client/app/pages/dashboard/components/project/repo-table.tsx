import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import type { IDomain, IEnvRepository } from "@seliseblocks/genesis-os/models";
import { formatFullDate } from "@seliseblocks/genesis-os/utils";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { DASHBOARD_TABLE_PAGE_SIZE } from "../dashboard.constant";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { SetCustomDomainDialog } from "../custom-domain/dialog";

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<IEnvRepository>();

const buildColumns = (onSet: (repo: IEnvRepository) => void) => [
  columnHelper.accessor("repoName", {
    header: "Name",
    cell: (info) => (
      <span className="text-sm font-medium text-high-emphasis">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("defaultDeploymentUrl", {
    header: "Deployment Domain",
    cell: (info) => <span className="text-sm text-medium-emphasis">{info.getValue()}</span>,
  }),
  columnHelper.accessor("customDeploymentUrl", {
    header: "Custom Domain",
    cell: ({ row }) => {
      const repo = row.original;
      return repo.customDeploymentUrl ? (
        <span className="text-sm text-medium-emphasis">{repo.customDeploymentUrl}</span>
      ) : (
        <Button variant="outline" size="xxs" onClick={() => onSet(repo)}>
          <span className="px-2">Set</span>
        </Button>
      );
    },
  }),
  columnHelper.display({
    id: "lastDeploymentDate",
    header: "Last Deployment Date",
    cell: ({ row }) => {
      const repo = row.original;
      const isDefaultDate = repo.lastDeploymentDate === "0001-01-01T00:00:00";
      return (
        <div className="text-sm text-medium-emphasis">
          {!repo.lastDeploymentDate || isDefaultDate
            ? "Not deployed"
            : formatFullDate(new Date(repo.lastDeploymentDate))}
        </div>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const repo = row.original;
      const hasCustomDomain = !!repo.customDeploymentUrl;
      const tooltipText = hasCustomDomain
        ? "Edit custom domain"
        : "Set a custom domain first to enable editing";
      return (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit custom domain"
                disabled={!hasCustomDomain}
                onClick={() => onSet(repo)}
                className="disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tooltipText}</TooltipContent>
          </Tooltip>
        </div>
      );
    },
  }),
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ProjectRepoTableProps {
  data: IEnvRepository[];
  domains: IDomain[];
  projectKey: string;
  projectEnv: string;
  /** Page index is owned by the parent: this table is unmounted and remounted on every
   *  background refetch (see repo-list.tsx), which would destroy state held here. */
  page: number;
  onPageChange: (pageIndex: number) => void;
}

export const ProjectRepoTable = ({
  data,
  domains,
  projectKey,
  projectEnv,
  page,
  onPageChange,
}: ProjectRepoTableProps) => {
  // ── Set custom domain dialog ────────────────────────────────────────────────
  const [setTarget, setSetTarget] = useState<IEnvRepository | null>(null);
  const [setDialogOpen, setSetDialogOpen] = useState(false);

  const handleSet = (repo: IEnvRepository) => {
    setSetTarget(repo);
    setSetDialogOpen(true);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = buildColumns(handleSet);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // See `autoResetPageIndex` in domain-table.tsx: the queued reset would override the
    // clamp below.
    autoResetPageIndex: false,
    state: { pagination: { pageIndex: page, pageSize: DASHBOARD_TABLE_PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: page, pageSize: DASHBOARD_TABLE_PAGE_SIZE })
          : updater;
      onPageChange(next.pageIndex);
    },
  });

  const lastPageIndex = Math.max(0, table.getPageCount() - 1);

  // Clamp a now-out-of-range page back to the last one that exists, before paint.
  // Routed through the table (not straight to onPageChange) so every page change
  // takes the same path out through onPaginationChange.
  useLayoutEffect(() => {
    if (page > lastPageIndex) table.setPageIndex(lastPageIndex);
  }, [page, lastPageIndex, table]);

  return (
    <>
      {/* Set custom domain dialog — one instance, target swaps per row */}
      <SetCustomDomainDialog
        open={setDialogOpen}
        onOpenChange={(open) => {
          setSetDialogOpen(open);
          if (!open) setSetTarget(null);
        }}
        repo={setTarget}
        domains={domains}
        projectKey={projectKey}
        projectEnv={projectEnv}
      />

      {/* Table */}
      <div className="relative w-full overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
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
                  No repositories found for this project.
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

      {/* Pagination — same component and same rules as the Domains section. */}
      {data.length > 0 && (
        <nav
          aria-label="Repositories pagination"
          className="mt-4 flex items-center md:justify-end"
        >
          <Pagination
            page={page}
            pageSize={DASHBOARD_TABLE_PAGE_SIZE}
            totalCount={data.length}
            onChange={(nextPageIndex) => table.setPageIndex(nextPageIndex)}
          />
        </nav>
      )}
    </>
  );
};
