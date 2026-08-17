import { useGetOrganizationConfig } from "@blocks-idp/iam/hooks/use-organization";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { SingleOrgAccess } from "./single-org-access";
import { MultiOrgAccess } from "./multi-org-access";

type UserAccessTabProps = {
  userId: string;
  projectKey: string;
};

export const UserAccessTab = ({ userId, projectKey }: UserAccessTabProps) => {
  const { data: configData, isLoading: isConfigLoading } = useGetOrganizationConfig(projectKey);
  const { isLoading: isUserLoading } = useGetUserById({ id: userId, projectKey });

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

  if (isMultiOrgEnabled) {
    return <MultiOrgAccess userId={userId} projectKey={projectKey} />;
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card p-6">
      <SingleOrgAccess userId={userId} projectKey={projectKey} />
    </div>
  );
};
