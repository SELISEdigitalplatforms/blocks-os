// import { useMemo } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useSetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetOrganizationConfig } from "@blocks-idp/iam/hooks/use-organization";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { useProjectStore } from "@seliseblocks/genesis-os";
// import { IPermission, PermissionSeverityLevel } from "@blocks-idp/iam/models/permission";
import { RoleDetailsProvider, useRoleDetailsStore } from "./role-details-state";
// import { PermissionSeverity } from "@blocks-idp/iam/components/permission-severity/permission-severity";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { useState } from "react";
import { PermissionsSelectionPanel } from "./permissions-selection-panel";

const RoleDetailsPageSkeleton = () => (
  <>
    <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
      <Skeleton className="h-7 w-56 sm:h-8 sm:w-72" />
      <Skeleton className="h-9 w-32 rounded-sm" />
    </div>
    <Card>
      <CardContent className="space-y-3 py-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-sm" />
        ))}
      </CardContent>
    </Card>
  </>
);

export function RoleDetailsContainer() {
  const role = useRoleDetailsStore((state) => state.role);
  const isEditMode = useRoleDetailsStore((state) => state.isEditMode);
  const discardChanges = useRoleDetailsStore((state) => state.discardChanges);
  const commitChanges = useRoleDetailsStore((state) => state.commitChanges);
  const changeEditMode = useRoleDetailsStore((state) => state.changeEditMode);
  const isInitialized = useRoleDetailsStore((state) => state.isInitialized);
  const permissionMap = useRoleDetailsStore((state) => state.permissionMap);
  const { isPending, mutateAsync } = useSetRoles();
  const { tenantId } = useProjectStore().selectedProject || { tenantId: "" };
  const { data: orgConfig } = useGetOrganizationConfig(tenantId);
  // Only offered when the tenant actually has other organizations to propagate to. Single-org
  // tenants never see the control and never send the field.
  const isMultiOrgEnabled = orgConfig?.isMultiOrgEnabled ?? false;
  const [propagateToAllOrganizations, setPropagateToAllOrganizations] = useState(false);

  const onSaveClick = async () => {
    const changedPermissions = Array.from(permissionMap.values()).reduce(
      (acc, item) => {
        if (!item.modified) return acc;
        if (item.changeState === "added") {
          acc.added.push(item.itemId);
          return acc;
        }
        if (item.changeState === "removed") {
          acc.removed.push(item.itemId);
          return acc;
        }
        return acc;
      },
      { added: [] as string[], removed: [] as string[] },
    );
    if (!role?.slug || (!changedPermissions.added.length && !changedPermissions.removed.length))
      return null;
    try {
      await mutateAsync({
        addPermissions: changedPermissions.added,
        removePermissions: changedPermissions.removed,
        slug: role.slug,
        organizationId: role.organizationId,
        // Omitted entirely unless the tenant is multi-org AND the box is ticked, so a single-org
        // tenant's payload is byte-for-byte what it was before this existed.
        ...(isMultiOrgEnabled && propagateToAllOrganizations
          ? { propagateToAllOrganizations: true }
          : {}),
      });
      commitChanges();
      setPropagateToAllOrganizations(false);
      showSuccessToast({ description: "Role permissions updated successfully" });
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        const { errors } = error;
        showErrorToast({ errors });
      }
    }
  };

  if (!isInitialized || !role?.slug) {
    return <RoleDetailsPageSkeleton />;
  }

  const breadcrumbTitles =
    role?.itemId && role?.name ? { ["/app/iam/role-detail/" + role.itemId]: role.name } : undefined;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <PageBreadcrumb
          breadcrumbIndex={4}
          className="flex min-w-0 flex-1"
          customTitles={breadcrumbTitles}
        />
        <div className="flex shrink-0 items-center gap-2">
          {!isEditMode ? (
            <Button variant="outline" onClick={() => changeEditMode(true)}>
              <span>Edit Permissions</span>
            </Button>
          ) : (
            <>
              {isMultiOrgEnabled && (
                <label className="mr-2 flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={propagateToAllOrganizations}
                    onCheckedChange={(checked) =>
                      setPropagateToAllOrganizations(checked === true)
                    }
                    aria-label="Apply this change to all organizations"
                  />
                  <span title="This applies only the permissions you add or remove here. It does not otherwise change other organizations' settings.">
                    Apply this change to all organizations
                  </span>
                </label>
              )}
              <Button variant="outline" disabled={isPending} onClick={() => discardChanges()}>
                <span>Discard</span>
              </Button>
              <Button disabled={isPending} onClick={onSaveClick}>
                <span>Save Changes</span>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4">
        <PermissionsSelectionPanel />
      </div>
    </>
  );
}
export function RoleDetails({ params }: { params: { id: string } }) {
  const { id } = params;
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return (
    <RoleDetailsProvider id={id} projectKey={tenantId}>
      <RoleDetailsContainer />
    </RoleDetailsProvider>
  );
}
