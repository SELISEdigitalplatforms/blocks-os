// import { useMemo } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useSetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetOrganizationConfig } from "@blocks-idp/iam/hooks/use-organization";
import { useProjectStore } from "@seliseblocks/genesis-os";
// import { IPermission, PermissionSeverityLevel } from "@blocks-idp/iam/models/permission";
import { RoleDetailsProvider, useRoleDetailsStore } from "./role-details-state";
// import { PermissionSeverity } from "@blocks-idp/iam/components/permission-severity/permission-severity";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { useState } from "react";
import { PermissionsSelectionPanel } from "./permissions-selection-panel";
import { ApplyPermissionChangesDialog } from "./apply-permission-changes-dialog";

/**
 * Roles in this organization are the source every other organization's copy is created from, which
 * is what makes propagating a permission change from here meaningful at all. Matches
 * IdpConstants.DefaultOrganizationId on the backend.
 */
const DEFAULT_ORGANIZATION_ID = "default";

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

type PendingChange = { added: string[]; removed: string[] };

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

  // Both halves of the gate the backend enforces on the write. Multi-org alone is not enough: an
  // organization-scoped administrator's propagation flag is ignored server-side, so confirming it
  // here would promise something that never happens.
  const canOfferPropagation =
    (orgConfig?.isMultiOrgEnabled ?? false) && role?.organizationId === DEFAULT_ORGANIZATION_ID;

  // Captured when Save is pressed, not read live inside the dialog. The confirmation has to be
  // about the diff the user was shown; a selection edited behind an open dialog must not silently
  // become what gets applied.
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const collectChanges = (): PendingChange =>
    Array.from(permissionMap.values()).reduce<PendingChange>(
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
      { added: [], removed: [] },
    );

  const save = async (changes: PendingChange, propagateToAllOrganizations: boolean) => {
    if (!role?.slug) return;
    try {
      await mutateAsync({
        addPermissions: changes.added,
        removePermissions: changes.removed,
        slug: role.slug,
        organizationId: role.organizationId,
        // Omitted entirely rather than sent as false, so a single-organization tenant's payload is
        // byte-for-byte what it was before propagation existed.
        ...(propagateToAllOrganizations ? { propagateToAllOrganizations: true } : {}),
      });
      commitChanges();
      showSuccessToast({
        description: propagateToAllOrganizations
          ? "Role permissions updated across all organizations"
          : "Role permissions updated successfully",
      });
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        const { errors } = error;
        showErrorToast({ errors });
      }
      // Rethrown so the dialog knows the save failed and stays open on the user's selection.
      throw error;
    }
  };

  const onSaveClick = async () => {
    const changes = collectChanges();
    if (!role?.slug || (!changes.added.length && !changes.removed.length)) return;

    // The dialog is shown only where it has a decision to offer. Everywhere else -- single-org
    // tenants, organization-scoped administrators -- saving stays the one click it has always been.
    if (!canOfferPropagation) {
      await save(changes, false).catch(() => undefined);
      return;
    }

    setPendingChange(changes);
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

      {pendingChange && (
        <ApplyPermissionChangesDialog
          open
          onOpenChange={(next) => {
            if (!next) setPendingChange(null);
          }}
          roleName={role.name}
          slug={role.slug}
          organizationId={role.organizationId}
          addPermissions={pendingChange.added}
          removePermissions={pendingChange.removed}
          isPending={isPending}
          onConfirm={(propagateToAllOrganizations) =>
            save(pendingChange, propagateToAllOrganizations)
          }
        />
      )}
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
