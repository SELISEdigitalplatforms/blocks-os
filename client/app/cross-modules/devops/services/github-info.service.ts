import { http } from "@/lib/http/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "../constants/endpoint.constant";
import {
  IRepository,
  IBranch,
  IRepositoryUser,
  IBranchMatchResponse,
} from "../models/github-info";

export class GithubInfoService {
  async verifyAuthorization(code: string, projectKey: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.ACCESS_TOKEN}?code=${encodeURIComponent(code)}&ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  async checkAlreadyAuthorization(): Promise<{
    isSuccess: boolean;
  }> {
    const url = CLOUD_BUILD_ENDPOINTS.IS_AUTHORIZED;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  async revokeAccess(): Promise<{
    isSuccess: boolean;
  }> {
    const url = CLOUD_BUILD_ENDPOINTS.REMOVE_AUTHORIZATION;
    return http.post(url, {}, undefined, { absoluteUrl: true });
  }

  async getGithubRepos(
    search?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Promise<{
    data: {
      items: IRepository[];
      total_count: number;
    };
    message: string | null;
    statusCode: number;
    errors: unknown;
    isSuccess: boolean;
  }> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }${pageNumber ? `&pageNumber=${pageNumber}` : ""}${pageSize ? `&pageSize=${pageSize}` : ""}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  async getRepositoryUser(): Promise<IRepositoryUser> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_USER}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  async getGithubBranches(repo: string, projectKey: string): Promise<IBranch[]> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCHES}?repo=${encodeURIComponent(repo)}&ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  async getRepoAndGitBranchMatch(
    repoId: string,
    projectKey: string,
  ): Promise<IBranchMatchResponse> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCH_EXISTS}?repoId=${encodeURIComponent(repoId)}&ProjectKey=${encodeURIComponent(projectKey)}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }
}

export const githubInfoService = new GithubInfoService();
