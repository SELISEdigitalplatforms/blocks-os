import { useMemo } from "react";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { useGrantScope } from "@blocks-idp/iam/hooks/use-grant-scope";
import { User } from "@blocks-idp/iam/models/user";
import { canManageUserAccess } from "@blocks-idp/iam/utils/grant-scope";

type TargetUser = Pick<User, "roles" | "permissions">;

/**
 * Whether the caller may act on a user (rule R3 as far as the client can tell). The server
 * decides in the end; this only disables the actions it would refuse. The caller and the
 * organization come from the token claims (`sub`, `org_id`).
 */
export const useUserManageability = () => {
  const { scope, isRestricted } = useGrantScope();
  const authUser = useAuthStore().user;
  const callerId = authUser?.sub;
  const organizationId = authUser?.org_id || "default";

  return useMemo(
    () => ({
      isRestricted,
      isSelf: (userId: string) => isRestricted && callerId !== undefined && callerId === userId,
      /** May the caller act on this user at all (profile, activation, sessions, access)? */
      canManage: (user: TargetUser | undefined) => {
        if (!isRestricted || !user) return true;
        // Self is judged separately (`isSelf`): the caller may still edit their own profile fields.
        return canManageUserAccess(scope, {
          roles: user.roles?.[organizationId] ?? [],
          permissions: user.permissions?.[organizationId] ?? [],
        });
      },
    }),
    [isRestricted, scope, callerId, organizationId],
  );
};
