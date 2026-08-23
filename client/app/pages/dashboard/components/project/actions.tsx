import { ArchiveProject } from "./archive";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { RenderConditionally } from "@seliseblocks/genesis-os/components";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { OnboardProject } from "../onboard";

type ProjectActionsProps = {
  itemId: string;
  isDisabled: boolean;
  createdBy: string;
  isFetching?: boolean;
};

export const ProjectActions = ({
  isDisabled,
  createdBy,
  isFetching = false,
}: ProjectActionsProps) => {
  const { user } = useAuthStore();
  const isOwner = createdBy === user?.sub;

  if (isFetching) {
    return <ProjectActionsSkeleton />;
  }

  return (
    // Onboarding instructions are useful to every member, so they sit outside
    // the owner-only guard that gates deletion.
    <RenderConditionally condition={!isDisabled}>
      <div className="flex items-center gap-2">
        {/* <EditProject /> */}
        <OnboardProject />
        <RenderConditionally condition={isOwner}>
          <ArchiveProject />
        </RenderConditionally>
      </div>
    </RenderConditionally>
  );
};

const ProjectActionsSkeleton = () => {
  return (
    <div className="flex items-center gap-2">
      {/* <Skeleton className="h-10 w-20 rounded-md" /> */}
      <Skeleton className="h-10 w-28 rounded-md" />
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
};
