import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { useUserManageability } from "@blocks-idp/iam/hooks/use-user-manageability";
import { SessionListCard } from "@blocks-idp/iam/security/components/session-list-card";
import { CANNOT_MANAGE_USER_TOOLTIP } from "@blocks-idp/iam/utils/delegation-scope";

type DevicesProps = {
  id: string;
  projectKey: string;
};

export const UserDevices = ({ id, projectKey }: DevicesProps) => {
  const { data } = useGetUserById({ id, projectKey });
  const { canManage } = useUserManageability();
  // Signing a user out is a write on that user (rule R3).
  const readOnlyReason = canManage(data?.data) ? undefined : CANNOT_MANAGE_USER_TOOLTIP;
  return <SessionListCard showSignOut userId={id} readOnlyReason={readOnlyReason} />;
};
