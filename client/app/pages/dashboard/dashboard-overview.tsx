import { useCallback, useEffect } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useGetProject, useValidateCNameProject } from "@/hooks/use-project";
import { getDomain } from "@/lib/domain";
import { showErrorToast } from "@seliseblocks/blocks-kit/utils";
import { ProjectDetail } from "@/components/project-detail/project-detail";
import { ProjectRepoList } from "@/components/project-repo-list/project-repo-list";
import { ProjectCliSnippet } from "@/components/project-cli-snippet/project-cli-snippet";
import { GitCommandSnippet } from "@/components/git-command-snippet/git-command-snippet";
import { ActionsListProject } from "@/components/actions-list-project/actions-list-project";

export const DashboardOverview = () => {
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const projectKey = selectedProject?.tenantId || "";

  const { data, isLoading } = useGetProject({
    projectId: selectedProject?.itemId || "",
  });
  const { mutateAsync } = useValidateCNameProject({ projectKey });
  const cNameValidator = useCallback(async () => {
    try {
      if (
        !data?.data.customDomain ||
        getDomain(data.data.customDomain) === "seliseblocks.com"
      )
        return;
      await mutateAsync({
        projectKey: projectKey,
        cookieDomain: new URL(data?.data?.customDomain).hostname,
      });
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: error.errors });
      }
    }
  }, [data?.data.customDomain, mutateAsync, projectKey]);
  useEffect(() => {
    cNameValidator();
  }, [cNameValidator]);
  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold md:text-2xl">
          Environment Overview
        </h1>
        <ActionsListProject />
      </div>
      <ProjectDetail project={data?.data} isLoading={isLoading} />
      <ProjectRepoList project={data?.data} isLoading={isLoading} />
      <ProjectCliSnippet />
      <GitCommandSnippet />
    </main>
  );
};
