import { useMemo, useState } from "react";
import { Label } from "@/components/ui-kits/label/label";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { SSORolesList } from "@blocks-idp/authentication/components/sso-initial-roles/sso-roles-list";
import { toRoleStubs } from "@blocks-idp/iam/utils/role-stub";
import { IRole } from "@blocks-idp/iam/models/role";
import { AddClientCredentialRole } from "./add-client-credential-role";

type ClientCredentialRolesSectionProps = {
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
};

export const ClientCredentialRolesSection = ({
  selectedSlugs,
  onChange,
}: ClientCredentialRolesSectionProps) => {
  const [filter, setFilter] = useState({ page: 0, pageSize: 5 });
  const roles = useMemo(() => toRoleStubs(selectedSlugs), [selectedSlugs]);

  const slicedRoles = roles.slice(
    filter.page * filter.pageSize,
    filter.page * filter.pageSize + filter.pageSize,
  );

  const handleAdd = (newSlugs: string[]) => {
    const merged = [...new Set([...selectedSlugs, ...newSlugs])];
    onChange(merged);
  };

  const handleRemove = (role: IRole) => {
    onChange(selectedSlugs.filter((slug) => slug !== role.slug));
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
            Select the default roles granted when this client credential is used.
          </p>
        </div>
        <div className="shrink-0">
          <AddClientCredentialRole selectedSlugs={selectedSlugs} onAdd={handleAdd} />
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
          <p className="mt-1 text-xs text-muted-foreground">Add roles for this client credential</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border">
            <SSORolesList roles={slicedRoles} onDelete={handleRemove} />
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
                onChange={(page) => setFilter((prev) => ({ ...prev, page }))}
                totalCount={roles.length}
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
