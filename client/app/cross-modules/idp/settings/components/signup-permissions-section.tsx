import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { AssignSignupPermissionsDialog } from "@blocks-idp/settings/components/assign-signup-permissions-dialog";
import { SettingsAssignmentChip } from "@blocks-idp/settings/components/settings-assignment-chip";
import { SettingsUnsavedBadge } from "@blocks-idp/settings/components/settings-unsaved-badge";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import type { IPermission } from "@blocks-idp/iam/models/permission";
import { useMemo } from "react";

type SignupPermissionsSectionProps = {
  /** Current selection — this is what gets saved, and what the dialog seeds from. */
  permissions: IPermission[];
  /** Saved in the DB but dropped from the selection; shown struck through until saved. */
  removedPermissions: IPermission[];
  /** Permission names currently persisted in the DB, used to mark the rest as unsaved. */
  savedNames: string[];
  onChange: (permissions: IPermission[]) => void;
};

export const SignupPermissionsSection = ({
  permissions,
  removedPermissions,
  savedNames,
  onChange,
}: SignupPermissionsSectionProps) => {
  const savedNameSet = useMemo(() => new Set(savedNames), [savedNames]);

  const hasUnsavedChanges =
    removedPermissions.length > 0 ||
    permissions.some((permission) => !savedNameSet.has(permission.name));

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>Permissions</CardTitle>
          {hasUnsavedChanges ? <SettingsUnsavedBadge /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AssignSignupPermissionsDialog permissions={permissions} onAssign={onChange} />
        </div>
      </CardHeader>
      <CardContent>
        {permissions.length === 0 && removedPermissions.length === 0 ? (
          <p className={SETTINGS_FORM_LAYOUT.emptyState}>No permissions found</p>
        ) : (
          <div
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
            role="list"
            aria-label="Assigned permissions"
          >
            {permissions.map((permission) => (
              <SettingsAssignmentChip
                key={permission.name}
                label={permission.name}
                meta={permission.resource}
                variant={savedNameSet.has(permission.name) ? "saved" : "unsaved"}
                className="sm:max-w-[320px]"
              />
            ))}
            {removedPermissions.map((permission) => (
              <SettingsAssignmentChip
                key={permission.name}
                label={permission.name}
                meta={permission.resource}
                variant="removed"
                className="sm:max-w-[320px]"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
