import { ArchivedProject } from "@/components/archive-project/archive-project";
import { EditProject } from "@/components/edit-project/edit-project";
import { useGetProject } from "@/hooks/use-project";
import { useGetMe } from "@blocks-idp/iam/hooks/use-user";
import { useProjectStore } from "@seliseblocks/blocks-kit";
export const ActionsListProject = () => {
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const { data, isLoading, isFetching } = useGetProject({
    projectId: selectedProject?.itemId || "",
  });
  const { data: loggedInUser } = useGetMe();
  const isOwner = data?.data?.createdBy === loggedInUser?.data?.itemId;
  return (
    <div className="flex items-center gap-2">
      {!isLoading && !isFetching && !data?.data?.isDisabled && isOwner && (
        <ArchivedProject />
      )}
      {!data?.data?.isDisabled && (
        <>
          {!isLoading && !isFetching && (
            <EditProject data={data} isLoading={isLoading} />
          )}
        </>
      )}
    </div>
  );
};
