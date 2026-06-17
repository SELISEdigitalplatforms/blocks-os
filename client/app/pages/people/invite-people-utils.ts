import type { IInviteEnvironmentDetail, IInvitePeoplePayload } from "@/models/people"

export const emailRegex = /^(?=.{1,320}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const DEFAULT_INVITE_ROLES = ["user"] as const

const getInviteRolesFromAuthStorage = (): string[] => {
  try {
    const raw = localStorage.getItem("auth-storage")
    if (!raw) return [...DEFAULT_INVITE_ROLES]

    const parsed = JSON.parse(raw) as {
      state?: { user?: { roles?: Record<string, string[]> } | { roles?: Record<string, string[]> }[] }
    }
    const user = parsed.state?.user
    const rolesRecord = Array.isArray(user) ? user[0]?.roles : user?.roles
    const orgRoles = rolesRecord ? Object.values(rolesRecord).flat() : []

    return orgRoles.length > 0 ? orgRoles : [...DEFAULT_INVITE_ROLES]
  } catch {
    return [...DEFAULT_INVITE_ROLES]
  }
}

export const buildInviteEnvironmentDetail = (tenantId: string): IInviteEnvironmentDetail => ({
  tenantId,
  roles: getInviteRolesFromAuthStorage(),
})

export const buildInvitePeoplePayload = (
  invitationsMap: Record<string, string[]>,
  groupId: string,
): IInvitePeoplePayload => {
  const invitations: IInvitePeoplePayload["invitations"] = {}

  Object.entries(invitationsMap).forEach(([email, tenantIds]) => {
    const uniqueTenantIds = Array.from(new Set(tenantIds))
    invitations[email] = uniqueTenantIds.map((tenantId) => buildInviteEnvironmentDetail(tenantId))
  })

  return { invitations, groupId }
}
