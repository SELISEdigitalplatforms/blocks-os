import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import type { IEnvRepository } from "@seliseblocks/genesis-os/models";
import type { IDomain } from "@/models/project.model";
import { formatFullDate } from "@seliseblocks/genesis-os/utils";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";
import { FilterControls } from "@/components/filter-toolbar";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { DASHBOARD_TABLE_PAGE_SIZE } from "../dashboard.constant";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { SetCustomDomainDialog } from "../custom-domain/dialog";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.dashboard";

// ─── Column helper ────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<IEnvRepository>();

const buildColumns = (onSet: (repo: IEnvRepository) => void) => [
  columnHelper.accessor("repoName", {
    header: tStatic(I18N_MODULE, "common:NAME"),
    cell: (info) => (
      <span className="text-sm font-medium text-high-emphasis">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor("defaultDeploymentUrl", {
    header: tStatic(I18N_MODULE, "REPO_TABLE.DEPLOYMENT_DOMAIN"),
    cell: (info) => <span className="text-sm text-medium-emphasis">{info.getValue()}</span>,
  }),
  columnHelper.accessor("customDeploymentUrl", {
    header: tStatic(I18N_MODULE, "REPO_TABLE.CUSTOM_DOMAIN"),
    cell: ({ row }) => {
      const repo = row.original;
      return repo.customDeploymentUrl ? (
        <span className="text-sm text-medium-emphasis">{repo.customDeploymentUrl}</span>
      ) : (
        <Button variant="outline" size="xxs" onClick={() => onSet(repo)}>
          <span className="px-2">{tStatic(I18N_MODULE, "REPO_TABLE.SET")}</span>
        </Button>
      );
    },
  }),
  columnHelper.display({
    id: "lastDeploymentDate",
    header: tStatic(I18N_MODULE, "REPO_TABLE.LAST_DEPLOYMENT_DATE"),
    cell: ({ row }) => {
      const repo = row.original;
      const isDefaultDate = repo.lastDeploymentDate === "0001-01-01T00:00:00";
      return (
        <div className="text-sm text-medium-emphasis">
          {!repo.lastDeploymentDate || isDefaultDate
            ? tStatic(I18N_MODULE, "REPO_TABLE.NOT_DEPLOYED")
            : formatFullDate(new Date(repo.lastDeploymentDate))}
        </div>
      );
    },
  }),
  columnHelper.display({
    id: "actions",
    header: tStatic(I18N_MODULE, "common:ACTIONS"),
    cell: ({ row }) => {
      const repo = row.original;
      const hasCustomDomain = !!repo.customDeploymentUrl;
      const tooltipText = hasCustomDomain
        ? tStatic(I18N_MODULE, "REPO_TABLE.EDIT_CUSTOM_DOMAIN")
        : tStatic(I18N_MODULE, "REPO_TABLE.SET_A_CUSTOM_DOMAIN_FIRST");
      return (
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tStatic(I18N_MODULE, "REPO_TABLE.EDIT_CUSTOM_DOMAIN")}
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
  search: string;
  onSearchChange: (value: string) => void;
}

export const ProjectRepoTable = ({
  data,
  domains,
  projectKey,
  projectEnv,
  page,
  onPageChange,
  search,
  onSearchChange,
}: ProjectRepoTableProps) => {
  const { t } = useT(I18N_MODULE);
  // ── Set custom domain dialog ────────────────────────────────────────────────
  const [setTarget, setSetTarget] = useState<IEnvRepository | null>(null);
  const [setDialogOpen, setSetDialogOpen] = useState(false);

  const handleSet = (repo: IEnvRepository) => {
    setSetTarget(repo);
    setSetDialogOpen(true);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const columns = buildColumns(handleSet);
  const filteredData = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    return data.filter((repo) => repo.repoName.toLowerCase().includes(normalizedSearch));
  }, [data, search]);
  const table = useReactTable({
    data: filteredData,
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

      {data.length > 0 && (
        <div className="mb-4 flex justify-start">
          <FilterControls.SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={t("REPO_TABLE.SEARCH_REPOSITORIES")}
            className="w-64"
          />
        </div>
      )}

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
                  {data.length === 0
                    ? t("REPO_TABLE.NO_REPOSITORIES_FOUND_FOR_THIS")
                    : t("REPO_TABLE.NO_REPOSITORIES_MATCH_YOUR_SEARCH")}
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
      {filteredData.length > 0 && (
        <nav
          aria-label={t("REPO_TABLE.REPOSITORIES_PAGINATION")}
          className="mt-4 flex items-center md:justify-end"
        >
          <Pagination
            page={page}
            pageSize={DASHBOARD_TABLE_PAGE_SIZE}
            totalCount={filteredData.length}
            onChange={(nextPageIndex) => table.setPageIndex(nextPageIndex)}
          />
        </nav>
      )}
    </>
  );
};
