import { useCreateProjectFormState } from "@/components/create-project/utils";
import { buildCreateProjectPayload } from "@/utils/create-project-payload";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import {
  IRestoreProjectPayload,
  IUpdateProjectPayload,
  IValidateCnameProjectPayload,
} from "@/models/project.model";
import { projectService } from "@/services/project.service";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { useImpersonateStore, useProjectStore } from "@seliseblocks/genesis-os";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";

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

export const useGetProject = () => {
  const { isInitialized, isImpersonated, impersonatedTenantId, originalTenantId } =
    useImpersonateStore();

  // The endpoint answers "the project of whoever I am", so the tenant the token
  // is scoped to is what identifies the response — key the cache on that, not on
  // a URL id the server never reads. Staying disabled until the impersonation
  // state is known keeps the request from firing against an unresolved token and
  // caching another tenant's project.
  const tenantId = isImpersonated ? impersonatedTenantId : originalTenantId;

  return useQuery({
    queryKey: ["identifier", "project", tenantId],
    queryFn: () => projectService.getProject(),
    enabled: isInitialized && Boolean(tenantId),
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
    queryFn: () => crossProjectService.getAssets(tenantGroupId, page, pageSize, search),
    // Paging and searching are server side, so hold the previous page on screen while the
    // next one loads instead of dropping back to the skeleton on every keystroke.
    placeholderData: keepPreviousData,
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

export const useDeleteAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["assets", "delete"],
    mutationFn: crossProjectService.deleteAsset,
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
    mutationFn: (payload: IUpdateProjectPayload) => crossProjectService.updateProject(payload),
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

export const useValidateCNameProject = (options: IValidateCnameProjectPayload) => {
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

export const useGetProjectStatus = (itemId?: string) => {
  return useQuery({
    queryKey: ["identifier", "project-status", itemId],
    queryFn: () => projectService.getProjectStatus(itemId as string),
    enabled: Boolean(itemId),
  });
};

export const useRestoreProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["identifier", "project", "restore"],
    mutationFn: (payload: IRestoreProjectPayload) => projectService.restoreProject(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["identifier", "project-status", variables.itemId],
      });
      queryClient.invalidateQueries({ queryKey: ["identifier", "project"] });
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

// The server only returns trackers with unfinished services, and the environments page treats
// one as ongoing for ten minutes after it was created.
export const MIGRATION_ONGOING_WINDOW_MS = 10 * 60 * 1000;
const MIGRATION_STATUS_POLL_MS = 5000;

export const useGetMigrationStatus = (tenantGroupId: string) => {
  return useQuery({
    queryKey: ["identifier", "migration-status", tenantGroupId],
    queryFn: () => crossProjectService.getMigrationStatus(tenantGroupId),
    enabled: !!tenantGroupId,
    // The completion push alone is not enough. The wizard redirects from the console layout to
    // the project layout, and genesis-os tears the notification socket down and rebuilds it on
    // that switch; a migration that finishes a couple of seconds later pushes into the gap and
    // SignalR does not replay it. Poll while a migration is in its ongoing window.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) return false;
      const cutoff = Date.now() - MIGRATION_ONGOING_WINDOW_MS;
      const hasOngoing = data.some(
        (d) => !!d.createdDate && new Date(d.createdDate).getTime() > cutoff,
      );
      return hasOngoing ? MIGRATION_STATUS_POLL_MS : false;
    },
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
      const assets = formData[1]?.assets || [];

      const response = await mutateAsync(
        buildCreateProjectPayload({
          name: formData[0].name,
          isAcceptBlocksTerms: formData[0].isAcceptBlocksTerms,
          isUseBlocksExclusively: formData[0].isUseBlocksExclusively,
          environments,
          assets,
        }),
      );
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
