import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card"
import { AddSSOPermission } from "@blocks-idp/authentication/components/sso-initial-permissions/add-sso-permission"
import type { IPermission } from "@blocks-idp/iam/models/permission"
import { SettingsDismissibleChip } from "@blocks-idp/settings/components/settings-dismissible-chip"
import { Lock } from "lucide-react"

type SignupPermissionsSectionProps = {
  permissions: IPermission[]
  onChange: (permissions: IPermission[]) => void
  readOnly?: boolean
}

export const SignupPermissionsSection = ({
  permissions,
  onChange,
  readOnly = false,
}: SignupPermissionsSectionProps) => {
  const handleAdd = (newPermissions: IPermission[]) => {
    onChange([...permissions, ...newPermissions])
  }

  const handleRemove = (permission: IPermission) => {
    onChange(permissions.filter((item) => item.resource !== permission.resource))
  }

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-row items-start justify-between gap-3">
        <CardTitle className="text-base sm:text-lg">Permissions</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          {readOnly ? (
            <Lock
              className="h-4 w-4 text-muted-foreground"
              aria-label="Locked until sign up is enabled"
            />
          ) : (
            <AddSSOPermission onAdd={handleAdd} permissions={permissions} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {permissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No permissions found</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {permissions.map((permission) => (
              <SettingsDismissibleChip
                key={permission.name}
                title={permission.name}
                subtitle={permission.resource}
                confirmTitle="Remove Permission"
                confirmSubtitle="Are you sure you want to remove this permission?"
                onDismiss={() => handleRemove(permission)}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
