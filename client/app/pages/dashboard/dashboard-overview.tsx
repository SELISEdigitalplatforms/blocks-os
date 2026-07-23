import { useGetProject } from "@/hooks/use-project";
import { DomainsSection } from "./components/domain";
import {
  ProjectActions,
  ProjectOverview,
  ProjectRepoList,
} from "./components/project";

export const DashboardOverview = () => {
  const { data, isFetching } = useGetProject();

  if (!data?.data) return null;

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ProjectOverview
          name={data?.data?.name || ""}
          environment={data?.data?.environment || ""}
          tenantId={data?.data?.tenantId || ""}
          isFetching={isFetching}
        />
        <ProjectActions
          isDisabled={!!data?.data?.isDisabled}
          createdBy={data?.data?.createdBy || ""}
          isFetching={isFetching}
        />
      </div>
      <DomainsSection applications={data?.data.applications || []} />
      <ProjectRepoList project={data?.data} isLoading={isFetching} />
    </main>
  );
};
