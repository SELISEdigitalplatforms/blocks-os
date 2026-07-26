import { useState } from "react";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { AddSSORole } from "./add-sso-role";
import { SSORolesList } from "./sso-roles-list";
import { IRole } from "@blocks-idp/iam/models/role";
import { Label } from "@/components/ui-kits/label/label";

type SSOInitialRolesProps = {
  roles: IRole[];
  onChange: (data: IRole[]) => void;
};

export const SSOInitialRoles = ({ roles, onChange }: SSOInitialRolesProps) => {
  const [filter, setFilter] = useState({ page: 0, pageSize: 5 });
  const onPageChangeHandler = (page: number) => {
    setFilter((filter) => ({ ...filter, page }));
  };
  const slicedRoles =
    roles.slice(filter.page * filter.pageSize, filter.page * filter.pageSize + filter.pageSize) ||
    [];
  const onAddHandler = (newRoles: IRole[]) => {
    onChange([...roles, ...newRoles]);
  };
  const onRemoveHandler = (role: IRole) => {
    onChange(roles.filter((item) => item.slug !== role.slug));
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Roles</Label>
            {roles.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {roles.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Assign default roles to users automatically when they authenticate via SSO
          </p>
        </div>
        <div className="shrink-0">
          <AddSSORole onAdd={onAddHandler} roles={roles} />
        </div>
      </div>
      {roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No roles added</p>
          <p className="mt-1 text-xs text-muted-foreground">Add roles for SSO users</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border">
            <SSORolesList roles={slicedRoles} onDelete={onRemoveHandler} />
          </div>
          {roles.length > filter.pageSize && (
            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Showing {filter.page * filter.pageSize + 1} to{" "}
                {Math.min((filter.page + 1) * filter.pageSize, roles.length)} of {roles.length}{" "}
                roles
              </p>
              <Pagination
                page={filter.page}
                onChange={onPageChangeHandler}
                totalCount={roles.length || 0}
                pageSizeOptions={[filter.pageSize]}
                pageSize={filter.pageSize}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
