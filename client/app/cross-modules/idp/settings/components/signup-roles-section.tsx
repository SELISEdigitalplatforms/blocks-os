import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { AssignSignupRolesDialog } from "@blocks-idp/settings/components/assign-signup-roles-dialog"
import { SettingsAssignmentChip } from "@blocks-idp/settings/components/settings-assignment-chip"
import { SettingsUnsavedBadge } from "@blocks-idp/settings/components/settings-unsaved-badge"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import type { IRole } from "@blocks-idp/iam/models/role"
import { useMemo } from "react"

type SignupRolesSectionProps = {
  /** Current selection — this is what gets saved, and what the dialog seeds from. */
  roles: IRole[]
  /** Saved in the DB but dropped from the selection; shown struck through until saved. */
  removedRoles: IRole[]
  /** Role slugs currently persisted in the DB, used to mark the rest as unsaved. */
  savedSlugs: string[]
  onChange: (roles: IRole[]) => void
}

export const SignupRolesSection = ({
  roles,
  removedRoles,
  savedSlugs,
  onChange,
}: SignupRolesSectionProps) => {
  const savedSlugSet = useMemo(() => new Set(savedSlugs), [savedSlugs])

  const hasUnsavedChanges =
    removedRoles.length > 0 || roles.some((role) => !savedSlugSet.has(role.slug))

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className={SETTINGS_FORM_LAYOUT.sectionTitle}>Roles</CardTitle>
          {hasUnsavedChanges ? <SettingsUnsavedBadge /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AssignSignupRolesDialog roles={roles} onAssign={onChange} />
        </div>
      </CardHeader>
      <CardContent>
        {roles.length === 0 && removedRoles.length === 0 ? (
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
                variant={savedSlugSet.has(role.slug) ? "saved" : "unsaved"}
                className="sm:max-w-[280px]"
              />
            ))}
            {removedRoles.map((role) => (
              <SettingsAssignmentChip
                key={role.slug}
                label={role.name}
                meta={role.slug}
                variant="removed"
                className="sm:max-w-[280px]"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
