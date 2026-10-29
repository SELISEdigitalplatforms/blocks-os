import { useGetOrganizationConfig } from "@blocks-idp/iam/hooks/use-organization";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { useUserManageability } from "@blocks-idp/iam/hooks/use-user-manageability";
import {
  CANNOT_MANAGE_USER_TOOLTIP,
  OWN_ROLES_TOOLTIP,
} from "@blocks-idp/iam/utils/grant-scope";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { SingleOrgAccess } from "./single-org-access";
import { UserAccessAttributes } from "../user-access-attributes";
import { MultiOrgAccess } from "./multi-org-access";

const getAccessLockedReason = (isSelf: boolean, canManage: boolean): string | null => {
  if (isSelf) return OWN_ROLES_TOOLTIP;
  return canManage ? null : CANNOT_MANAGE_USER_TOOLTIP;
};

type UserAccessTabProps = {
  userId: string;
  projectKey: string;
};

export const UserAccessTab = ({ userId, projectKey }: UserAccessTabProps) => {
  const { data: configData, isLoading: isConfigLoading } = useGetOrganizationConfig(projectKey);
  const { data: userData, isLoading: isUserLoading } = useGetUserById({ id: userId, projectKey });
  const { isSelf, canManage } = useUserManageability();

  const isMultiOrgEnabled = configData?.isMultiOrgEnabled ?? false;

  if (isConfigLoading || isUserLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    );
  }

  // Rule R3: not yourself, and only users whose access you could have granted yourself.
  const lockedReason = getAccessLockedReason(isSelf(userId), canManage(userData?.data));
  const access = isMultiOrgEnabled ? (
    <MultiOrgAccess userId={userId} projectKey={projectKey} />
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card p-6">
      <SingleOrgAccess userId={userId} projectKey={projectKey} />
    </div>
  );
  const content = (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <div className="min-h-0 flex-1">{access}</div>
      <UserAccessAttributes userId={userId} projectKey={projectKey} />
    </div>
  );

  if (!lockedReason) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-full min-h-0 min-w-0 flex-col" data-testid="user-access-locked">
            <p className="mb-2 text-sm text-muted-foreground">{lockedReason}</p>
            {/* A disabled fieldset turns off every button and field inside it. */}
            <fieldset disabled className="m-0 flex h-full min-h-0 min-w-0 flex-col border-0 p-0">
              {content}
            </fieldset>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{lockedReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
