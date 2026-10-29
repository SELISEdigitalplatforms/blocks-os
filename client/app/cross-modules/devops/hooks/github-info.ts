import { useQuery } from "@tanstack/react-query";
import { githubInfoService } from "../services/github-info.service";
import { useProjectStore } from "@seliseblocks/genesis-os";

export const useGithubVerification = (code: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["github-verification", projectKey, code],
    queryFn: () => githubInfoService.verifyAuthorization(code, projectKey),
    enabled: !!code && !!projectKey,
  });
};

export const useValidateAuthorization = () => {
  return useQuery({
    queryKey: ["verify-auth"],
    queryFn: () => githubInfoService.checkAlreadyAuthorization(),
    retry: false,
  });
};

export const useRevokeAccess = () => {
  return useQuery({
    queryKey: ["revoke-access"],
    queryFn: () => githubInfoService.revokeAccess(),
    retry: false,
    enabled: false, // Only run when explicitly called
  });
};

export const useGetGithubRepos = (
  isVerificationSuccessful: boolean,
  search?: string,
  page?: number,
  perPage?: number,
) => {
  return useQuery({
    queryKey: ["github-repos", isVerificationSuccessful, search, page, perPage],
    queryFn: () => githubInfoService.getGithubRepos(search, page, perPage),
    enabled: isVerificationSuccessful,
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};

export const useGetRepositoryUser = (isVerificationSuccessful: boolean) => {
  return useQuery({
    queryKey: ["repository-user", isVerificationSuccessful],
    queryFn: () => githubInfoService.getRepositoryUser(),
    enabled: isVerificationSuccessful,
  });
};

export const useGithubBranches = (repo: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["github-branches", projectKey, repo],
    queryFn: () => githubInfoService.getGithubBranches(repo, projectKey),
    enabled: !!repo && !!projectKey,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useRepoAndGitBranchMatch = (repoId: string, enabled: boolean = true) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["git-branch-match", projectKey, repoId],
    queryFn: () => githubInfoService.getRepoAndGitBranchMatch(repoId, projectKey),
    enabled: !!repoId && enabled && !!projectKey,
    retry: false,
    refetchOnMount: true,
  });
};
