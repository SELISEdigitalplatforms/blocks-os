import { useMemo } from "react";
import { Label } from "@/components/ui-kits/label/label";
import { toPermissionStubs } from "@blocks-idp/authentication/components/identity-provider/identity-provider-form.util";
import { SSOPermissionsList } from "@blocks-idp/authentication/components/sso-initial-permissions/sso-permissions-list";
import { IPermission } from "@blocks-idp/iam/models/permission";
import { AddClientCredentialPermission } from "./add-client-credential-permission";

type ClientCredentialPermissionsSectionProps = {
  selectedResources: string[];
  onChange: (resources: string[]) => void;
  maxPermissions?: number;
};

export const ClientCredentialPermissionsSection = ({
  selectedResources,
  onChange,
  maxPermissions = 10,
}: ClientCredentialPermissionsSectionProps) => {
  const permissions = useMemo(() => toPermissionStubs(selectedResources), [selectedResources]);

  const handleAdd = (newResources: string[]) => {
    const merged = [...new Set([...selectedResources, ...newResources])].slice(0, maxPermissions);
    onChange(merged);
  };

  const handleRemove = (permission: IPermission) => {
    onChange(selectedResources.filter((resource) => resource !== permission.resource));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">Permissions</Label>
            {permissions.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {permissions.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Select permissions to include in the access token granted by this client.
          </p>
        </div>
        <div className="shrink-0">
          <AddClientCredentialPermission
            selectedResources={selectedResources}
            onAdd={handleAdd}
            maxPermissions={maxPermissions}
          />
        </div>
      </div>
      {permissions.length === 0 ? (
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No permissions added</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add permissions for this client credential
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <SSOPermissionsList permissions={permissions} onDelete={handleRemove} />
        </div>
      )}
      {selectedResources.length >= maxPermissions && (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxPermissions} permissions reached. Remove one to add another.
        </p>
      )}
    </div>
  );
};
