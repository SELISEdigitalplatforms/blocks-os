import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { GithubInfoService } from "./github-info.service";
import { CLOUD_BUILD_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("GithubInfoService (extra methods)", () => {
  let service: GithubInfoService;

  beforeEach(() => {
    service = new GithubInfoService();
    vi.clearAllMocks();
  });

  afterEach(() => vi.clearAllMocks());

  it("getRepositoryUser GETs the github user endpoint with absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getRepositoryUser();
    expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.GITHUB_USER, undefined, ABS);
  });

  it("getRepoAndGitBranchMatch encodes repoId and project key", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getRepoAndGitBranchMatch("repo 1", "key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCH_EXISTS}?repoId=repo%201&ProjectKey=key%2F1`,
      undefined,
      ABS,
    );
  });

  it("repoInitialDeploy POSTs to the run build endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { repoId: "r1" } as never;
    await service.repoInitialDeploy(payload);
    expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.RUN_BUILD, payload);
  });

  it("manualDeploy POSTs to the manual endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { repoId: "r1" } as never;
    await service.manualDeploy(payload);
    expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.MANUAL, payload);
  });

  it("getAllRepos encodes the project key against the repos endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await service.getAllRepos("key/1");
    expect(http.get).toHaveBeenCalledWith(`${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=key%2F1`);
  });

  it("getAllRepoBuilds hits the repos endpoint with the encoded project key", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getAllRepoBuilds("key/1");
    expect(http.get).toHaveBeenCalledWith(`${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=key%2F1`);
  });

  it("getAllProjects hits the repos list endpoint with absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getAllProjects("key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}?ProjectKey=key%2F1`,
      undefined,
      ABS,
    );
  });

  it("getCardRepoAndBranches encodes buildId and project key", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getCardRepoAndBranches("build 1", "key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.BUILD}?buildId=build%201&ProjectKey=key%2F1`,
    );
  });

  it("changeRepoSpecs POSTs to the settings endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { id: "1" } as never;
    await service.changeRepoSpecs(payload);
    expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS, payload);
  });

  it("changeRepoSettings PUTs to the settings endpoint", async () => {
    vi.mocked(http.put).mockResolvedValue({} as never);
    const payload = { id: "1" } as never;
    await service.changeRepoSettings(payload);
    expect(http.put).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS, payload);
  });

  it("getBuildLogs keeps repoId raw and encodes the project key", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getBuildLogs("r1", "key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.RUN_BUILD}?repoId=r1&ProjectKey=key%2F1`,
    );
  });

  it("getRepoCardsAndBranches encodes the project key with absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getRepoCardsAndBranches("key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?ProjectKey=key%2F1`,
      undefined,
      ABS,
    );
  });
});
