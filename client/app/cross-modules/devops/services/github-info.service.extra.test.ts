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
});
