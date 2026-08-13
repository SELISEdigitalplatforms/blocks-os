import { API_BASES } from "@/constants/endpoint.constant";

export const CLOUD_BUILD_ENDPOINTS = {
  // Authentication & Authorization
  ACCESS_TOKEN: `${API_BASES.OS}/release/accessToken`,
  IS_AUTHORIZED: `${API_BASES.OS}/release/isAuthorized`,
  REMOVE_AUTHORIZATION: `${API_BASES.OS}/release/removeAuthorization`,

  // GitHub Repositories
  GITHUB_REPOS: `${API_BASES.OS}/release/getrepos`,
  GITHUB_USER: `${API_BASES.OS}/release/getuser`,
  GITHUB_BRANCHES: `${API_BASES.OS}/release/getbranches`,
  GITHUB_BRANCH_EXISTS: `${API_BASES.OS}/release/githubbranchExists`,
};
