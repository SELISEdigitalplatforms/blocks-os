import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { AssignSignupRolesDialog } from "@blocks-idp/settings/components/assign-signup-roles-dialog"
import { SettingsAssignmentChip } from "@blocks-idp/settings/components/settings-assignment-chip"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import type { IRole } from "@blocks-idp/iam/models/role"

type SignupRolesSectionProps = {
  roles: IRole[]
  onChange: (roles: IRole[]) => void
}

export const SignupRolesSection = ({ roles, onChange }: SignupRolesSectionProps) => (
  <Card>
    <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
      <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>Roles</CardTitle>
      <div className="flex shrink-0 items-center gap-2">
        <AssignSignupRolesDialog roles={roles} onAssign={onChange} />
      </div>
    </CardHeader>
    <CardContent>
      {roles.length === 0 ? (
        <p className={SETTINGS_FORM_LAYOUT.emptyState}>No roles found</p>
      ) : (
        <div
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          role="list"
          aria-label="Assigned roles"
        >
          {roles.map((role) => (
            <SettingsAssignmentChip
              key={role.slug}
              label={role.name}
              meta={role.slug}
              className="sm:max-w-[280px]"
            />
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)
