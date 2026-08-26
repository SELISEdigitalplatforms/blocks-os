import { FilterControls } from "@/components/filter-toolbar";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { ArchiveAction } from "@blocks-idp/iam/components/archive-action";
import { useDeletePermission } from "@blocks-idp/iam/hooks/use-permission";
import {
  IPermission,
  PERMISSION_SEVERITY_OPTIONS,
  PermissionSeverityLevel,
  ResourceType,
} from "@blocks-idp/iam/models/permission";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { KeyRound, Pencil } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { usePermissionsSortQuaryParams } from "./permissions-filter-toolbar";

type PermissionTableProps = { permissions: IPermission[]; isLoading: boolean };

const LoadingSkelton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-[72px] w-full rounded-xl" />
    ))}
  </div>
);

export const PermissionSeverityBadge = ({ severity }: { severity: PermissionSeverityLevel }) => {
  const config = PERMISSION_SEVERITY_OPTIONS.find((option) => option.value === severity);
  if (!config) return null;
  return (
    <Badge variant={config.variant} className={cn(config.className, config.bg)}>
      {config.label}
    </Badge>
  );
};

const PermissionRowActions = ({ row }: { row: IPermission }) => {
  const { mutateAsync, isPending } = useDeletePermission();
  const scoped = useScopedPath();
  return (
    <div
      className="flex justify-end"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {!row.isBuiltIn && (
        <Link to={scoped(`iam/permission-detail/${row.itemId}`)}>
          <Button
            size="icon"
            className="rounded-full"
            variant="ghost"
            aria-label={`Edit permission ${row.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </Link>
      )}
      <ArchiveAction
        entity="permission"
        name={row.name}
        itemId={row.itemId}
        archive={mutateAsync}
        isPending={isPending}
      />
    </div>
  );
};

export const PermissionsList = ({ permissions, isLoading }: PermissionTableProps) => {
  const { sortQueryParams, setSortQueryParams } = usePermissionsSortQuaryParams();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const openPermission = (itemId: string) => navigate(scoped(`iam/permission-detail/${itemId}`));

  if (isLoading) return <LoadingSkelton />;
  if (!permissions.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground">
        <KeyRound className="h-6 w-6" />
        No permission found. Please create new permission.
      </div>
    );
  }

  return (
    <div className="scrollbar-hidden-x overflow-x-hidden md:overflow-x-auto">
      <div className="flex flex-col gap-3 md:min-w-[980px]">
        <div className="hidden grid-cols-[minmax(220px,1fr)_110px_110px_110px_110px_88px] items-center gap-4 px-4 md:grid">
          <div className="flex min-w-0 items-center gap-4">
            <FilterControls.SortHeader
              label="Name"
              id="Name"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
            <FilterControls.SortHeader
              label="Resource"
              id="Resource"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
          <span className="font-bold text-medium-emphasis">Source</span>
          <FilterControls.SortHeader
            label="Type"
            id="Type"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
          <span className="font-bold text-medium-emphasis">Severity</span>
          <span className="font-bold text-medium-emphasis">No of Roles</span>
          <span />
        </div>

        {permissions.map((permission) => {
          const resourceName = ResourceType[permission.type] as string;
          return (
            <div
              key={permission.itemId}
              role="button"
              aria-label={`Open permission ${permission.name}`}
              tabIndex={0}
              onClick={() => openPermission(permission.itemId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPermission(permission.itemId);
                }
              }}
              className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:border-primary/30 focus-visible:border-primary/30 md:grid md:grid-cols-[minmax(220px,1fr)_110px_110px_110px_110px_88px] md:items-center md:gap-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold text-high-emphasis"
                    title={permission.name}
                  >
                    {permission.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={permission.resource}>
                    {permission.resource}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 md:block">
                <span className="text-xs text-muted-foreground md:hidden">Source</span>
                <Badge variant={permission.isBuiltIn ? "secondary" : "default"} className="w-fit">
                  {permission.isBuiltIn ? "Built In" : "Custom"}
                </Badge>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3 text-sm text-muted-foreground md:block">
                <span className="text-xs md:hidden">Type</span>
                <span className="block truncate">{resourceName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 md:block">
                <span className="text-xs text-muted-foreground md:hidden">Severity</span>
                <PermissionSeverityBadge severity={permission.permissionSeverity} />
              </div>
              <div className="flex items-center justify-between gap-3 md:block">
                <span className="text-xs text-muted-foreground md:hidden">No of Roles</span>
                <Badge variant="secondary" className="w-fit">
                  <span>{permission.roles.length}</span>&nbsp;
                  {permission.roles.length === 1 ? "role" : "roles"}
                </Badge>
              </div>
              <PermissionRowActions row={permission} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
