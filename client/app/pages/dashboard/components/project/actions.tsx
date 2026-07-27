import { ArchiveProject } from "./archive";
import { RestoreProject } from "./restore";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { RenderConditionally } from "@seliseblocks/blocks-kit/components";
import { useAuthStore } from "@seliseblocks/blocks-kit/store";

type ProjectActionsProps = {
  itemId: string;
  isDisabled: boolean;
  createdBy: string;
  isFetching?: boolean;
};

export const ProjectActions = ({
  itemId,
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
    <RenderConditionally condition={isOwner && !isDisabled}>
      <div className="flex items-center gap-2">
        {/* <EditProject /> */}
        <RestoreProject itemId={itemId} />
        <ArchiveProject />
      </div>
    </RenderConditionally>
  );
};

const ProjectActionsSkeleton = () => {
  return (
    <div className="flex items-center gap-2">
      {/* <Skeleton className="h-10 w-20 rounded-md" /> */}
      <Skeleton className="h-10 w-32 rounded-md" />
    </div>
  );
};
