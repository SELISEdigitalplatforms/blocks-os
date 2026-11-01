import { useMemo, useRef, useState } from "react";
import { FilterControls } from "@/components/filter-toolbar";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { showErrorToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { useProjectStore, useT } from "@seliseblocks/genesis-os";
import { useGetAssignableRoles } from "@blocks-idp/iam/hooks/use-roles";
import { IRole } from "@blocks-idp/iam/models/role";
import { Info, Plus, ShieldCheck } from "lucide-react";
import { getMinimumRoleMessage } from "./role-assignment.constants";
import { GrantHint } from "@blocks-idp/iam/components/grant-hint";

type AddOrganizationRoleProps = {
  roles: IRole[];
  /** Called with the complete role selection on confirm. */
  onChange: (data: IRole[]) => void;
  onSave?: () => void;
  /**
   * Scope the picker to a specific organization. When provided, the role
   * list is fetched with this id as the `organizationId` so the request
   * matches the per-org editor on the same page. Defaults to the tenant id.
   */
  organizationId?: string;
};

const MAX_ROLES_PER_USER = 5;

export const AddOrganizationRole = ({
  onChange,
  roles,
  onSave,
  organizationId,
}: AddOrganizationRoleProps) => {
  const { t } = useT("os.idp.users");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  // An explicit `organizationId` always wins. Sending the tenant id to
  // `/api/iam/roles` would either be wrong (different scope) or duplicate
  // the per-org editor's request. Empty string is treated as "not provided"
  // so the picker doesn't fall back to `tenantId` between the time the page
  // mounts and the org data resolves.
  const scopeKey = organizationId || tenantId;
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [selectedRoles, setSelectedRoles] = useState<IRole[]>([]);
  const [filter, setFilter] = useState({ page: 0, pageSize: 10, search: "" });

  const { data, isLoading } = useGetAssignableRoles(
    {
      page: filter.page,
      pageSize: filter.pageSize,
      projectKey: scopeKey,
      // The field IAM actually reads. Without it the list falls back to the caller
      // token's organization -- "default" for a tenant-wide admin -- and offered
      // roles that do not exist in the organization being edited.
      organizationId,
      sort: { property: "Name", isDescending: false },
      filter: {
        search: filter.search,
      },
    },
    // Don't fetch the role list until the picker is opened. The per-org
    // editor on this page already fetches with a matching queryKey, so an
    // eager fetch here would be a redundant `/api/iam/roles` request.
    { enabled: open && !!scopeKey },
  );

  const rolesSlug = useMemo(
    () => roles.map((item) => item.slug) || [],
    [roles],
  );

  const selectedRolesSlug = useMemo(
    () => selectedRoles.map((item) => item.slug) || [],
    [selectedRoles],
  );

  const totalRoleCount = selectedRoles.length;
  const isAtMaxRoles = totalRoleCount >= MAX_ROLES_PER_USER;

  const isRoleSelectedInModal = (slug: string) =>
    selectedRolesSlug.includes(slug);

  const hasSelectionChanged =
    selectedRolesSlug.length !== rolesSlug.length ||
    selectedRolesSlug.some((slug) => !rolesSlug.includes(slug));

  const onCheckedChangeHandler = (checked: boolean, role: IRole) => {
    if (checked) {
      if (totalRoleCount >= MAX_ROLES_PER_USER) {
        return;
      }
      return setSelectedRoles((currentRoles) =>
        currentRoles.some((item) => item.slug === role.slug)
          ? currentRoles
          : [...currentRoles, role],
      );
    }
    if (selectedRoles.length === 1 && selectedRolesSlug.includes(role.slug)) {
      showErrorToast({ errors: getMinimumRoleMessage() });
      return;
    }
    setSelectedRoles((currentRoles) =>
      currentRoles.filter((item) => item.slug !== role.slug),
    );
  };

  const pageChangeHandler = (page: number) =>
    setFilter((prev) => ({ ...prev, page }));

  const reset = () => {
    setSelectedRoles([]);
    setFilter({ page: 0, pageSize: 10, search: "" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          // Edit a local copy so Cancel never leaks partial role removals to
          // the parent form and an existing role can be unchecked immediately.
          setSelectedRoles(roles);
        } else {
          reset();
        }
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-primary bg-accent hover:bg-transparent hover:text-accent-foreground"
          type="button"
          onClick={(e) => e.stopPropagation()}
        >
          <Plus className="h-4 w-4 md:mr-1.5" />
          <span className="sr-only sm:not-sr-only">{t("ADD_ORGANIZATION_ROLE.MANAGE_ROLES")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        ref={dialogContentRef}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogContentRef.current
            ?.querySelector<HTMLInputElement>("input")
            ?.focus();
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-left">{t("ADD_ORGANIZATION_ROLE.TITLE")}</DialogTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("ADD_ORGANIZATION_ROLE.ROLE_ASSIGNMENT_REQUIREMENT")}
                    className="inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-hidden"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-[240px] whitespace-normal text-center"
                >
                  {getMinimumRoleMessage()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge
              variant="success"
              className="font-normal"
              aria-live="polite"
              aria-label={t("ADD_ORGANIZATION_ROLE.SELECTED_ARIA_LABEL", {
                count: totalRoleCount,
                max: MAX_ROLES_PER_USER,
              })}
            >
              {t("ADD_ORGANIZATION_ROLE.SELECTED_BADGE", {
                count: totalRoleCount,
                max: MAX_ROLES_PER_USER,
              })}
            </Badge>
          </div>
          <DialogDescription className="text-left">
            {t("ADD_ORGANIZATION_ROLE.MAX_ROLES_DESCRIPTION", { max: MAX_ROLES_PER_USER })}
          </DialogDescription>
        </DialogHeader>
        <GrantHint kind="roles" />
        <div>
          <FilterControls.SearchInput
            value={filter.search}
            onChange={(value) =>
              setFilter((prev) => ({ ...prev, search: value, page: 0 }))
            }
            className="h-fit w-full py-3"
            placeholder={t("ADD_ORGANIZATION_ROLE.SEARCH_PLACEHOLDER")}
          />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2">
            {Array.from({ length: filter.pageSize }).map((_, idx) => (
              <div
                key={idx}
                className="flex animate-pulse items-center space-x-2 py-2"
              >
                <div className="h-4 w-4 rounded bg-gray-200" />
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-20 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : data && data.data && data.data.length > 0 ? (
          <div className="grid grid-cols-2">
            {data.data.map((item) => (
              <div
                key={item.itemId}
                className="col-span-1 flex items-center py-2"
              >
                <Checkbox
                  checked={isRoleSelectedInModal(item.slug)}
                  disabled={!isRoleSelectedInModal(item.slug) && isAtMaxRoles}
                  aria-label={t(
                    isRoleSelectedInModal(item.slug)
                      ? "ADD_ORGANIZATION_ROLE.DESELECT_ROLE"
                      : "ADD_ORGANIZATION_ROLE.SELECT_ROLE",
                    { name: item.name },
                  )}
                  onCheckedChange={(value) =>
                    onCheckedChangeHandler(!!value, item)
                  }
                />
                <div className="ml-2 flex flex-col">
                  <div className="max-w-[150px] truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div
                    className="max-w-[150px] truncate text-sm text-muted-foreground"
                    title={item.slug}
                  >
                    {item.slug}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("ADD_ORGANIZATION_ROLE.NO_ROLES_ADDED")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("ADD_ORGANIZATION_ROLE.ADD_AT_LEAST_ONE_ROLE")}
            </p>
          </div>
        )}
        <div>
          {!isLoading && data && data.totalCount > filter.pageSize && (
            <div className="flex items-center md:justify-end">
              <Pagination
                page={filter.page}
                onChange={pageChangeHandler}
                totalCount={data.totalCount || 0}
                pageSize={filter.pageSize}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="default">
              {t("common:CANCEL")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            size="default"
            disabled={!hasSelectionChanged}
            onClick={() => {
              onChange(selectedRoles);
              reset();
              setOpen(false);
              // Defer save so the parent React tree has time to commit the
              // queued `setSelectedRoles`/`setSelectedPermissions` updates
              // (and its refs) before `onSave` reads the latest values.
              setTimeout(() => onSave?.(), 0);
            }}
          >
            {t("common:ADD")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
