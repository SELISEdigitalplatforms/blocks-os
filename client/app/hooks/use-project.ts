import {
 shortGuidGenerator,
 useCreateProjectFormState,
} from "@/components/create-project/utils";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
 IUpdateProjectPayload,
 IValidateCnameProjectPayload,
} from "@/models/project.model";
import { projectService } from "@/services/project.service";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const useGetProjects = ({
 tenantGroupId,
 enabled = true,
}: {
 tenantGroupId?: string;
 enabled?: boolean;
}) => {
 const { setProjects } = useProjectStore();

 const query = useQuery({
  queryKey: ["identifier", "projects", tenantGroupId],
  queryFn: () => projectService.getProjects(0, 100, tenantGroupId),
  enabled: enabled,
  staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary re-fetches during navigation
 });

 useEffect(() => {
  if (!query.data) return;
  const flattenedProjects = query.data.flatMap((group) => group.projects);
  setProjects(flattenedProjects);
 }, [query.data, setProjects]);

 return query;
};

export const useGetProject = (options?: { projectId: string }) => {
 const { selectedProject } = useProjectStore();
 const projectId = options?.projectId ?? selectedProject?.itemId ?? "";
 const resolvedOptions = { projectId };
 return useQuery({
  queryKey: ["identifier", "project", resolvedOptions],
  queryFn: () => projectService.getProject(resolvedOptions),
  enabled: Boolean(projectId),
 });
};

export const useGetAssets = (
 tenantGroupId: string,
 page: number = 0,
 pageSize: number = 12,
 search: string = "",
) => {
 return useQuery({
  queryKey: ["get-assets", tenantGroupId, page, pageSize, search],
  queryFn: () => crossProjectService.getAssets(tenantGroupId),
 });
};

export const useAddAssets = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["assets", "add"],
  mutationFn: crossProjectService.addAssets,
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ["get-assets"] });
   queryClient.invalidateQueries({ queryKey: ["env-repositories"] });
  },
 });
};

export const useGetEnvRepositories = (projectKey: string) => {
 return useQuery({
  queryKey: ["env-repositories", projectKey],
  queryFn: () => crossProjectService.getEnvRepositories(),
  enabled: !!projectKey,
 });
};

export const useUpdateRepositories = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["env-repositories", "update"],
  mutationFn: crossProjectService.repoUpdate,
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ["env-repositories"] });
  },
 });
};

export const useUpdateProject = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "project-update"],
  mutationFn: (payload: IUpdateProjectPayload) =>
   crossProjectService.updateProject(payload),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ["identifier", "project"] });
   queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
  },
 });
};

export const useUpdateTenantGroup = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "project-update-tenant-group"],
  mutationFn: (payload: { name: string; tenantGroupId: string }) =>
   crossProjectService.updateTenantGroup(payload),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
   queryClient.invalidateQueries({ queryKey: ["identifier", "project"] });
   queryClient.invalidateQueries({ queryKey: ["get-assets"] });
   queryClient.invalidateQueries({ queryKey: ["env-repositories"] });
  },
 });
};

export const useValidateCNameProject = (
 options: IValidateCnameProjectPayload,
) => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "projects", options],
  mutationFn: () => crossProjectService.validateCNameProject(options),
  onSuccess: () => {
   queryClient.invalidateQueries({
    queryKey: ["identifier", "project"],
   });
  },
 });
};

export const useDisableProject = (options: { projectKey: string }) => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "projects", "disable"],
  mutationFn: () => crossProjectService.disableProject(options),
  onSuccess: () => {
   queryClient.invalidateQueries({
    queryKey: ["identifier", "project", options],
   });
   queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
  },
 });
};

export const useCreateProject = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "projects", "create"],
  mutationFn: crossProjectService.createProject,
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
   queryClient.invalidateQueries({ queryKey: ["get-assets"] });
   queryClient.invalidateQueries({ queryKey: ["env-repositories"] });
  },
 });
};

export const useGetMigrationStatus = (tenantGroupId: string) => {
 return useQuery({
  queryKey: ["identifier", "migration-status", tenantGroupId],
  queryFn: () => crossProjectService.getMigrationStatus(tenantGroupId),
  //TODO: Enable this query when the migration feature is ready to be used
  enabled: false,
 });
};

export const useInitiateMigration = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "migration", "initiate"],
  mutationFn: crossProjectService.initiateMigration,
  onSuccess: () => {
   queryClient.invalidateQueries({
    queryKey: ["identifier", "migration-status"],
   });
  },
 });
};

export const useVerifyMigration = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: ["identifier", "migration", "verify"],
  mutationFn: crossProjectService.verifyMigration,
  onSuccess: () => {
   queryClient.invalidateQueries({
    queryKey: ["identifier", "migration-status"],
   });
   queryClient.invalidateQueries({ queryKey: ["identifier", "projects"] });
  },
 });
};

export const useProjectForm = () => {
 const navigate = useNavigate();
 const { isPending, mutateAsync } = useCreateProject();
 const { formData, resetFormData } = useCreateProjectFormState();
 const { setTenantGroup, setSelectedProject } = useProjectStore();
 const queryClient = useQueryClient();

 const saveProject = async () => {
  try {
   const environments = formData[2]?.environments || [];
   const shortGuid = shortGuidGenerator(5);
   const baseDomain = getRuntimeEnv("BLOCKS_BASE_DOMAIN") || "seliseblocks.com";
   const applicationContexts =
    environments.map((env: { value: string }) => ({
     environment: env.value,
     domain: `https://${env.value === "main" ? "" : env.value}-${shortGuid}.${baseDomain}`,
     cookieDomain: baseDomain,
    })) || [];

   const assets = formData[1]?.assets || [];

   const response = await mutateAsync({
    name: formData[0].name,
    isAcceptBlocksTerms: formData[0].isAcceptBlocksTerms,
    isUseBlocksExclusively: formData[0].isUseBlocksExclusively,
    resources: assets.map((asset) => ({
     name: asset.full_name,
     link: asset.html_url,
     resourceId: asset.id !== undefined ? String(asset.id) : "",
    })),
    applicationContexts,
   });
   if (response?.isSuccess) {
    showSuccessToast({ description: "Your project has been created." });
    setTenantGroup(response.tenantGroupId);

    try {
     const projectGroups = await queryClient.fetchQuery({
      queryKey: ["identifier", "projects", response.tenantGroupId],
      queryFn: () => projectService.getProjects(0, 100, response.tenantGroupId),
      staleTime: 0,
     });

     if (
      projectGroups &&
      projectGroups.length > 0 &&
      projectGroups[0].projects &&
      projectGroups[0].projects.length > 0
     ) {
      setSelectedProject(projectGroups[0].projects[0]);
     }
    } catch {
     showErrorToast({ errors: response.errors });
    }

    navigate(`/app/project/${response.tenantGroupId}/environments`);
    resetFormData();
   } else {
    showErrorToast({ errors: response.errors });
   }
  } catch (error: unknown) {
   if (error && typeof error === "object" && "errors" in error) {
    showErrorToast({ errors: (error as { errors: unknown }).errors });
   }
  }
 };

 return {
  isPending,
  saveProject,
 };
};
