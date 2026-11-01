import { useCallback, useState } from "react";
import { showErrorToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui-kits/label/label";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { IRole } from "@blocks-idp/iam/models/role";
import { Info, ShieldCheck } from "lucide-react";
import { AddOrganizationRole } from "./add-organization-role";
import { OrganizationRolesList } from "./organization-roles-list";
import { useT } from "@seliseblocks/genesis-os";
import { getMinimumRoleMessage } from "./role-assignment.constants";

type OrganizationRolesFieldProps = {
  roles: IRole[];
  onChange: (data: IRole[]) => void;
  onSave?: () => void;
  description?: string;
  organizationId?: string;
};

export const OrganizationRolesField = ({
  roles,
  onChange,
  onSave,
  description,
  organizationId,
}: OrganizationRolesFieldProps) => {
  const { t } = useT("os.idp.users");
  const [filter, setFilter] = useState({ page: 0, pageSize: 5 });

  const onPageChangeHandler = (page: number) => {
    setFilter((filter) => ({ ...filter, page }));
  };

  const slicedRoles =
    roles.slice(
      filter.page * filter.pageSize,
      filter.page * filter.pageSize + filter.pageSize,
    ) || [];

  const onRemoveHandler = useCallback(
    (role: IRole) => {
      if (roles.length <= 1) {
        showErrorToast({ errors: getMinimumRoleMessage() });
        return false;
      }
      (onChange as unknown as (fn: (prev: IRole[]) => IRole[]) => void)(
        (prevRoles) => prevRoles.filter((item) => item.slug !== role.slug),
      );
      return true;
    },
    [onChange, roles.length],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">{t("ORGANIZATION_ROLES_FIELD.ROLES")}</Label>
            {roles.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {roles.length}
              </span>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("ORGANIZATION_ROLES_FIELD.ROLE_ASSIGNMENT_REQUIREMENT")}
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
          </div>
          <p className="text-sm text-muted-foreground">
            {description ?? t("ORGANIZATION_ROLES_FIELD.DEFAULT_DESCRIPTION")}
          </p>
        </div>
        <div className="shrink-0">
          <AddOrganizationRole
            onChange={onChange}
            roles={roles}
            onSave={onSave}
            organizationId={organizationId}
          />
        </div>
      </div>
      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {t("ORGANIZATION_ROLES_FIELD.NO_ROLES_ADDED")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("ORGANIZATION_ROLES_FIELD.ADD_AT_LEAST_ONE_ROLE")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border">
            <OrganizationRolesList
              roles={slicedRoles}
              onDelete={onRemoveHandler}
              onSave={onSave}
            />
          </div>
          {roles.length > filter.pageSize && (
            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {t("ORGANIZATION_ROLES_FIELD.SHOWING", {
                  from: filter.page * filter.pageSize + 1,
                  to: Math.min((filter.page + 1) * filter.pageSize, roles.length),
                  count: roles.length,
                })}
              </p>
              <Pagination
                page={filter.page}
                onChange={onPageChangeHandler}
                totalCount={roles.length || 0}
                pageSize={filter.pageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
