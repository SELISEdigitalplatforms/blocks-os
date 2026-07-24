import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { GithubInfoService } from "./github-info.service";
import { CLOUD_BUILD_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("GithubInfoService", () => {
  let service: GithubInfoService;

  beforeEach(() => {
    service = new GithubInfoService();
    vi.clearAllMocks();
  });

  afterEach(() => vi.clearAllMocks());

  it("verifyAuthorization encodes the code and project key", async () => {
    vi.mocked(http.get).mockResolvedValue("token");
    const result = await service.verifyAuthorization("a b", "key/1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.ACCESS_TOKEN}?code=a%20b&ProjectKey=key%2F1`,
      undefined,
      ABS,
    );
    expect(result).toBe("token");
  });

  it("checkAlreadyAuthorization GETs the authorized endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue({ isSuccess: true });
    await service.checkAlreadyAuthorization();
    expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.IS_AUTHORIZED, undefined, ABS);
  });

  it("revokeAccess POSTs an empty body", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    await service.revokeAccess();
    expect(http.post).toHaveBeenCalledWith(
      CLOUD_BUILD_ENDPOINTS.REMOVE_AUTHORIZATION,
      {},
      undefined,
      ABS,
    );
  });

  it("removeAuthorization POSTs to the remove access token endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    await service.removeAuthorization();
    expect(http.post).toHaveBeenCalledWith(
      CLOUD_BUILD_ENDPOINTS.REMOVE_ACCESS_TOKEN,
      {},
      undefined,
      ABS,
    );
  });

  it("getGithubRepos omits optional query params when not provided", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getGithubRepos();
    expect(http.get).toHaveBeenCalledWith(`${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?`, undefined, ABS);
  });

  it("getGithubRepos includes search, pageNumber and pageSize", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getGithubRepos("my repo", 2, 25);
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?&search=my%20repo&pageNumber=2&pageSize=25`,
      undefined,
      ABS,
    );
  });

  it("getGithubBranches encodes repo and project key", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await service.getGithubBranches("org/repo", "pk");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCHES}?repo=org%2Frepo&ProjectKey=pk`,
      undefined,
      ABS,
    );
  });

  it("cloneGithubRepo POSTs the payload without absolute url options", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { repoId: "r1" } as never;
    await service.cloneGithubRepo(payload);
    expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.BUILD_BUILD, payload);
  });

  it("getSpecs GETs the settings endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getSpecs();
    expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS);
  });

  it("changeBuildSpecs uses PUT", async () => {
    vi.mocked(http.put).mockResolvedValue({} as never);
    const payload = { id: "1" } as never;
    await service.changeBuildSpecs(payload);
    expect(http.put).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.BUILD, payload);
  });

  it("getRepoDetails encodes both params and uses absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getRepoDetails("pk", "repo 1");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.REPO_DETAILS}?ProjectKey=pk&RepoId=repo%201`,
      undefined,
      ABS,
    );
  });

  it("propagates errors from the http layer", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("boom"));
    await expect(service.getRepositoryUser()).rejects.toThrow("boom");
  });
});
