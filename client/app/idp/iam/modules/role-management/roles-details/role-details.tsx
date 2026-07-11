// import { useMemo } from "react";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useSetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
// import { IPermission, PermissionSeverityLevel } from "@blocks-idp/iam/models/permission";
import { RoleDetailsProvider, useRoleDetailsStore } from "./role-details-state";
// import { PermissionSeverity } from "@blocks-idp/iam/components/permission-severity/permission-severity";
import { useQueryClient } from "@tanstack/react-query";
import { PermissionsSelectionPanel } from "./permissions-selection-panel";
export function RoleDetailsContainer() {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const queryClient = useQueryClient();
  const role = useRoleDetailsStore((state) => state.role);
  const isEditMode = useRoleDetailsStore((state) => state.isEditMode);
  const discardChanges = useRoleDetailsStore((state) => state.discardChanges);
  const commitChanges = useRoleDetailsStore((state) => state.commitChanges);
  const changeEditMode = useRoleDetailsStore((state) => state.changeEditMode);
  const isInitialized = useRoleDetailsStore((state) => state.isInitialized);
  const permissionMap = useRoleDetailsStore((state) => state.permissionMap);
  const { isPending, mutateAsync } = useSetRoles(role?.slug);
  BREADCRUMB_CUSTOM_TITLES["/app/idp/role-detail"] = "Roles";
  BREADCRUMB_CUSTOM_TITLES["/app/idp/role-detail/" + role?.itemId] = role?.name || "";
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
        projectKey: tenantId,
        slug: role.slug,
      });
      commitChanges();
      await queryClient.refetchQueries({ queryKey: ["permissions"] });
      showSuccessToast({ description: "Role permissions updated successfully" });
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        const { errors } = error;
        showErrorToast({ errors });
      }
    }
  };
  // Permission Severity Overview is temporarily disabled.
  // const permissionSeverityData = useMemo(() => {
  //   const permissions = Array.from(permissionMap.values());
  //   return Object.values(
  //     permissions
  //       .filter((item) => {
  //         if (item.modified && item.changeState === "added") return true;
  //         if (item.modified && item.changeState === "removed") return false;
  //         return item.isInitiallyAssigned;
  //       })
  //       .reduce(
  //         (acc, item: IPermission) => {
  //           const severityKey = item.permissionSeverity;
  //           if (!acc[severityKey]) {
  //             acc[severityKey] = {
  //               severityLevel: PermissionSeverityLevel[severityKey],
  //               count: 0,
  //             };
  //           }
  //           acc[severityKey].count += 1;
  //           return acc;
  //         },
  //         {} as Record<string, { severityLevel: string; count: number }>,
  //       ),
  //   );
  // }, [permissionMap]);
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 sm:mb-6">
        <PageBreadcrumb breadcrumbIndex={3} className="flex min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-2">
          {!isInitialized ? (
            <Skeleton className="h-9 w-32 rounded-sm" />
          ) : !isEditMode ? (
            <Button variant="outline" onClick={() => changeEditMode(true)}>
              <span>Edit Permissions</span>
            </Button>
          ) : (
            <>
              <Button variant="outline" disabled={isPending} onClick={() => discardChanges()}>
                <span>Discard</span>
              </Button>
              <Button disabled={isPending || !isInitialized} onClick={onSaveClick}>
                <span>Save Changes</span>
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4">
        {/* <PermissionSeverity data={permissionSeverityData} isLoading={!isInitialized} /> */}
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
