import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { AssignSignupPermissionsDialog } from "@blocks-idp/settings/components/assign-signup-permissions-dialog"
import { SettingsAssignmentChip } from "@blocks-idp/settings/components/settings-assignment-chip"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import type { IPermission } from "@blocks-idp/iam/models/permission"

type SignupPermissionsSectionProps = {
  permissions: IPermission[]
  onChange: (permissions: IPermission[]) => void
}

export const SignupPermissionsSection = ({
  permissions,
  onChange,
}: SignupPermissionsSectionProps) => (
  <Card>
    <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
      <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>Permissions</CardTitle>
      <div className="flex shrink-0 items-center gap-2">
        <AssignSignupPermissionsDialog permissions={permissions} onAssign={onChange} />
      </div>
    </CardHeader>
    <CardContent>
      {permissions.length === 0 ? (
        <p className={SETTINGS_FORM_LAYOUT.emptyState}>No permissions found</p>
      ) : (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          role="list"
          aria-label="Assigned permissions"
        >
          {permissions.map((permission) => (
            <SettingsAssignmentChip
              key={permission.resource}
              label={permission.name}
              meta={permission.resource}
              className="sm:max-w-[320px]"
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)
