import { FilterControls, SortValue } from "@/components/filter-toolbar";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { ArchiveAction } from "@blocks-idp/iam/components/archive-action";
import { useDeleteRole } from "@blocks-idp/iam/hooks/use-roles";
import { useDelegationScope } from "@blocks-idp/iam/hooks/use-delegation-scope";
import { IRole } from "@blocks-idp/iam/models/role";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Pencil, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { UpdateRole } from "../update-role/update-role";
import { useRolesSortQueryParams } from "./roles-filter-toolbar";

type RolesTableProps = {
  roles: IRole[];
  isLoading: boolean;
  showDefaultOriginBadge?: boolean;
};

const BASE_GRID = "md:grid-cols-[minmax(200px,1fr)_140px_120px_minmax(200px,1fr)_88px]";
const MANAGED_BY_GRID =
  "md:grid-cols-[minmax(200px,1fr)_140px_120px_minmax(140px,0.8fr)_minmax(200px,1fr)_88px]";

const LoadingSkelton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-[72px] w-full rounded-xl" />
    ))}
  </div>
);

const RoleRowActions = ({ row, onEdit }: { row: IRole; onEdit: (role: IRole) => void }) => {
  const { mutateAsync, isPending } = useDeleteRole();
  return (
    <div
      className="flex justify-end"
      role="presentation"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
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
    (value: SortValue) => setSortQueryParams(value),
    [setSortQueryParams],
  );
  const { isRestricted } = useDelegationScope();
  // The column is for people who work with the tree; the system user sees it only once a role has one.
  const showManagedBy = isRestricted || roles.some((role) => Boolean(role.parentRoleSlug));
  const gridColumns = showManagedBy ? MANAGED_BY_GRID : BASE_GRID;
  const nameBySlug = new Map(roles.map((role) => [role.slug, role.name]));
  const openRole = (itemId: string) => navigate(scoped(`iam/role-detail/${itemId}`));

  if (isLoading) return <LoadingSkelton />;
  if (!roles.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground">
        <ShieldCheck className="h-6 w-6" />
        No roles found. Please create new roles.
      </div>
    );
  }

  return (
    <>
      <div className="scrollbar-hidden-x overflow-x-hidden md:overflow-x-auto">
        <div className="flex flex-col gap-3 md:min-w-[840px]">
          <div
            className={`hidden items-center gap-4 px-4 md:grid ${gridColumns}`}
          >
            <FilterControls.SortHeader
              id="Name"
              label="Name"
              value={sortQueryParams}
              onChange={sortHandler}
            />
            <FilterControls.SortHeader
              id="Slug"
              label="Slug"
              value={sortQueryParams}
              onChange={sortHandler}
            />
            <FilterControls.SortHeader
              id="Count"
              label="Permissions"
              value={sortQueryParams}
              onChange={sortHandler}
            />
            {showManagedBy && <span className="font-bold text-medium-emphasis">Managed by</span>}
            <span className="font-bold text-medium-emphasis">Description</span>
            <span />
          </div>

          {roles.map((role) => (
            <div
              key={role.itemId}
              role="button"
              aria-label={`Open role ${role.name}`}
              tabIndex={0}
              onClick={() => openRole(role.itemId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openRole(role.itemId);
                }
              }}
              className={`group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 outline-hidden transition-colors hover:border-primary/30 focus-visible:border-primary/30 md:grid md:items-center md:gap-4 ${gridColumns}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <p
                    className="truncate text-sm font-semibold text-high-emphasis"
                    title={role.name}
                  >
                    {role.name}
                  </p>
                  {showDefaultOriginBadge && role.createdFromDefault && (
                    <Badge variant="secondary" className="shrink-0 font-normal">
                      Default
                    </Badge>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground md:hidden">Slug</span>
                <Badge variant="secondary" className="w-fit max-w-full font-normal">
                  <span className="truncate" title={role.slug}>
                    {role.slug}
                  </span>
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 md:block">
                <span className="text-xs text-muted-foreground md:hidden">Permissions</span>
                <Badge variant="secondary" className="w-fit">
                  <span>{role.count}</span>&nbsp;{role.count === 1 ? "permission" : "permissions"}
                </Badge>
              </div>
              {showManagedBy && (
                <div className="min-w-0">
                  <span className="text-xs text-muted-foreground md:hidden">Managed by</span>
                  <p className="truncate text-sm text-muted-foreground" data-testid="managed-by-cell">
                    {role.parentRoleSlug ? (nameBySlug.get(role.parentRoleSlug) ?? role.parentRoleSlug) : "-"}
                  </p>
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground md:hidden">Description</span>
                <p className="truncate text-sm text-muted-foreground" title={role.description}>
                  {role.description || "-"}
                </p>
              </div>
              <RoleRowActions row={role} onEdit={setSelectedRole} />
            </div>
          ))}
        </div>
      </div>
      {selectedRole && (
        <Dialog
          open
          onOpenChange={(value) => {
            if (!value) setSelectedRole(null);
          }}
        >
          <UpdateRole role={selectedRole} isOpen onClose={() => setSelectedRole(null)} />
        </Dialog>
      )}
    </>
  );
};
