import { API_BASES } from "@/constants/endpoint.constant";

export const CLOUD_BUILD_ENDPOINTS = {
  // Authentication & Authorization
  ACCESS_TOKEN: `${API_BASES.RELEASE}/auth/accessToken`,
  IS_AUTHORIZED: `${API_BASES.RELEASE}/auth/isAuthorized`,
  REMOVE_AUTHORIZATION: `${API_BASES.RELEASE}/auth/removeAuthorization`,
  REMOVE_ACCESS_TOKEN: `${API_BASES.RELEASE}/auth/removeAccessToken`,

  // GitHub Repositories
  GITHUB_REPOS: `${API_BASES.RELEASE}/github/repos`,
  GITHUB_USER: `${API_BASES.RELEASE}/github/user`,
  GITHUB_BRANCHES: `${API_BASES.RELEASE}/github/branches`,
  GITHUB_BRANCH_EXISTS: `${API_BASES.RELEASE}/github/branchExists`,

  // Build & Deployment
  BUILD_BUILD: "/api/build/clone",
  RUN_BUILD: "/api/build/run",
  MANUAL: "/api/build/manual",
  BUILD: "/api/build",

  // Repository Management
  REPOS: "/api/repos",
  REPOS_LIST: "/api/repos/list",
  REPO_DETAILS: "/api/repos/details",

  // Build Settings
  SETTINGS: "/api/settings",
};

export const MIGRATION_ENDPOINTS = {
  GET_STATUS: "/api/identifier/migration/status",
  START_MIGRATION: "/api/identifier/migration/start",
};
