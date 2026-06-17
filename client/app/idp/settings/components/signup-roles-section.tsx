import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { AddSSORole } from "@blocks-idp/authentication/components/sso-initial-roles/add-sso-role"
import type { IRole } from "@blocks-idp/iam/models/role"
import { SettingsDismissibleChip } from "@blocks-idp/settings/components/settings-dismissible-chip"
import { Lock } from "lucide-react"

type SignupRolesSectionProps = {
  roles: IRole[]
  onChange: (roles: IRole[]) => void
  readOnly?: boolean
}

export const SignupRolesSection = ({
  roles,
  onChange,
  readOnly = false,
}: SignupRolesSectionProps) => {
  const handleAdd = (newRoles: IRole[]) => {
    onChange([...roles, ...newRoles])
  }

  const handleRemove = (role: IRole) => {
    onChange(roles.filter((item) => item.slug !== role.slug))
  }

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-base sm:text-lg">Roles</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {readOnly ? (
            <Lock
              className="h-4 w-4 text-muted-foreground"
              aria-label="Locked until sign up is enabled"
            />
          ) : (
            <AddSSORole onAdd={handleAdd} roles={roles} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles found</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {roles.map((role) => (
              <SettingsDismissibleChip
                key={role.slug}
                title={role.name}
                subtitle={role.slug}
                confirmTitle="Remove Role"
                confirmSubtitle="Are you sure you want to remove this role?"
                onDismiss={() => handleRemove(role)}
                readOnly={readOnly}
                variant="badge"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
