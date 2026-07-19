import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { githubInfoService } from "../services/github-info.service";
import {
  useRevokeAccess,
  useGetAllProjects,
  useGetAllRepoBuilds,
  useGetCardProjectAndBranch,
  useManualDeployment,
  useChangeBuildSpecs,
  useChangeRepoSpecs,
} from "./github-info";

vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());
vi.mock("../services/github-info.service", () => ({
  githubInfoService: {
    revokeAccess: vi.fn(),
    getAllProjects: vi.fn(),
    getAllRepoBuilds: vi.fn(),
    getCardRepoAndBranches: vi.fn(),
    manualDeploy: vi.fn(),
    changeBuildSpecs: vi.fn(),
    changeRepoSpecs: vi.fn(),
  },
}));

const TENANT = "test-tenant-id-123";

describe("github-info hooks (extra)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("useRevokeAccess stays idle until explicitly triggered", () => {
    const { result } = renderHook(() => useRevokeAccess(), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(githubInfoService.revokeAccess).not.toHaveBeenCalled();
  });

  it("useGetAllProjects fetches when a project id is present", async () => {
    vi.mocked(githubInfoService.getAllProjects).mockResolvedValue([] as never);
    const { result } = renderHook(() => useGetAllProjects("pid-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getAllProjects).toHaveBeenCalledWith("pid-1");
  });

  it("useGetAllProjects is disabled without a project id", () => {
    const { result } = renderHook(() => useGetAllProjects(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(githubInfoService.getAllProjects).not.toHaveBeenCalled();
  });

  it("useGetAllRepoBuilds fetches builds for a project id", async () => {
    vi.mocked(githubInfoService.getAllRepoBuilds).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetAllRepoBuilds("pid-2"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getAllRepoBuilds).toHaveBeenCalledWith("pid-2");
  });

  it("useGetAllRepoBuilds is disabled without a project id", () => {
    const { result } = renderHook(() => useGetAllRepoBuilds(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetCardProjectAndBranch fetches with build id and tenant", async () => {
    vi.mocked(githubInfoService.getCardRepoAndBranches).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetCardProjectAndBranch("build-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(githubInfoService.getCardRepoAndBranches).toHaveBeenCalledWith("build-1", TENANT);
  });

  it("useGetCardProjectAndBranch is disabled without a build id", () => {
    const { result } = renderHook(() => useGetCardProjectAndBranch(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  describe("mutation error branches", () => {
    it("useManualDeployment logs on error", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(githubInfoService.manualDeploy).mockRejectedValue(new Error("m"));
      const { result } = renderHook(() => useManualDeployment(), {
        wrapper: createWrapper(),
      });
      await expect(result.current.mutateAsync({} as never)).rejects.toThrow("m");
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      errSpy.mockRestore();
    });

    it("useChangeBuildSpecs logs on error", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(githubInfoService.changeBuildSpecs).mockRejectedValue(new Error("b"));
      const { result } = renderHook(() => useChangeBuildSpecs(), {
        wrapper: createWrapper(),
      });
      await expect(result.current.mutateAsync({} as never)).rejects.toThrow("b");
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      errSpy.mockRestore();
    });

    it("useChangeRepoSpecs logs on error", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(githubInfoService.changeRepoSpecs).mockRejectedValue(new Error("r"));
      const { result } = renderHook(() => useChangeRepoSpecs(), {
        wrapper: createWrapper(),
      });
      await expect(result.current.mutateAsync({} as never)).rejects.toThrow("r");
      await waitFor(() => expect(errSpy).toHaveBeenCalled());
      errSpy.mockRestore();
    });
  });

  describe("mutation success side effects", () => {
    it("useChangeBuildSpecs resolves and records the build specs", async () => {
      vi.mocked(githubInfoService.changeBuildSpecs).mockResolvedValue({ id: "1" } as never);
      const { result } = renderHook(() => useChangeBuildSpecs(), {
        wrapper: createWrapper(),
      });
      await result.current.mutateAsync({} as never);
      expect(githubInfoService.changeBuildSpecs).toHaveBeenCalled();
    });
  });
});
