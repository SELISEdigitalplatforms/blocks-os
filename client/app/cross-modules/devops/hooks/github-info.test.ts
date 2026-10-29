import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { githubInfoService } from "../services/github-info.service";
import {
  useGithubVerification,
  useValidateAuthorization,
  useGetGithubRepos,
  useGetRepositoryUser,
  useGithubBranches,
  useRepoAndGitBranchMatch,
} from "./github-info";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("../services/github-info.service", () => ({
  githubInfoService: {
    verifyAuthorization: vi.fn(),
    checkAlreadyAuthorization: vi.fn(),
    revokeAccess: vi.fn(),
    getGithubRepos: vi.fn(),
    getRepositoryUser: vi.fn(),
    getGithubBranches: vi.fn(),
    getRepoAndGitBranchMatch: vi.fn(),
  },
}));

const TENANT = "test-tenant-id-123";

describe("github-info hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGithubVerification verifies with the code and tenant id", async () => {
    vi.mocked(githubInfoService.verifyAuthorization).mockResolvedValue("token");
    const { result } = renderHook(() => useGithubVerification("code-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.verifyAuthorization).toHaveBeenCalledWith("code-1", TENANT);
  });

  it("useGithubVerification is disabled without a code", () => {
    const { result } = renderHook(() => useGithubVerification(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useValidateAuthorization checks authorization", async () => {
    vi.mocked(githubInfoService.checkAlreadyAuthorization).mockResolvedValue({
      isSuccess: true,
    });
    const { result } = renderHook(() => useValidateAuthorization(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.checkAlreadyAuthorization).toHaveBeenCalled();
  });

  it("useGetGithubRepos only runs when verification succeeded", async () => {
    vi.mocked(githubInfoService.getGithubRepos).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetGithubRepos(true, "q", 1, 10), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getGithubRepos).toHaveBeenCalledWith("q", 1, 10);
  });

  it("useGetGithubRepos stays idle when not verified", () => {
    const { result } = renderHook(() => useGetGithubRepos(false), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetRepositoryUser fetches the user when verified", async () => {
    vi.mocked(githubInfoService.getRepositoryUser).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetRepositoryUser(true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getRepositoryUser).toHaveBeenCalled();
  });

  it("useGithubBranches fetches branches with tenant id", async () => {
    vi.mocked(githubInfoService.getGithubBranches).mockResolvedValue([]);
    const { result } = renderHook(() => useGithubBranches("org/repo"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getGithubBranches).toHaveBeenCalledWith("org/repo", TENANT);
  });

  it("useRepoAndGitBranchMatch fetches match info", async () => {
    vi.mocked(githubInfoService.getRepoAndGitBranchMatch).mockResolvedValue({} as never);
    const { result } = renderHook(() => useRepoAndGitBranchMatch("r-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getRepoAndGitBranchMatch).toHaveBeenCalledWith("r-1", TENANT);
  });
});
