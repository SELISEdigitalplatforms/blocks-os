import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { DashboardSectionCard } from "@seliseblocks/genesis-os/components";
import { useGetEnvRepositories } from "@/hooks/use-project";
import type { IProject } from "@seliseblocks/genesis-os/models";
import { useState } from "react";
import { ProjectRepoTable } from "./repo-table";

export const ProjectRepoList = ({
  project,
  isLoading,
}: {
  project: IProject;
  isLoading: boolean;
}) => {
  const { applications } = project;
  // Held here rather than in the table: the skeleton branch below unmounts the table on
  // every background refetch, which would silently return a reader to the first page.
  const [repoPageIndex, setRepoPageIndex] = useState(0);
  const {
    data: envRepositoriesResponse,
    isLoading: isLoadingEnvRepos,
    isFetching: isFetchingEnvRepos,
  } = useGetEnvRepositories(project?.tenantId || "");

  if (isLoading || isLoadingEnvRepos || isFetchingEnvRepos) {
    return (
      <div className="mt-6 rounded-lg border bg-card px-2 py-2 shadow-sm md:mt-0">
        <div className="grid-col-1 grid gap-3 px-2 py-4 md:grid-cols-2 md:gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_item, index) => (
            <div key={index}>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-2 h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DashboardSectionCard
      title="Repositories"
      description="Repositories deployed for this project"
      contentClassName="p-0"
    >
      <ProjectRepoTable
        data={envRepositoriesResponse?.data ?? []}
        domains={applications}
        projectKey={project?.tenantId || ""}
        projectEnv={project?.environment || ""}
        page={repoPageIndex}
        onPageChange={setRepoPageIndex}
      />
    </DashboardSectionCard>
  );
};
