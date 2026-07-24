import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { projectService } from "@/services/project.service";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import {
  useGetProjects,
  useGetProject,
  useGetAssets,
  useAddAssets,
  useGetEnvRepositories,
  useUpdateRepositories,
  useUpdateProject,
  useUpdateTenantGroup,
  useValidateCNameProject,
  useDisableProject,
  useCreateProject,
  useGetMigrationStatus,
  useInitiateMigration,
  useVerifyMigration,
} from "./use-project";

const setProjects = vi.fn();
const impersonateState = {
  isInitialized: true,
  isImpersonated: true,
  impersonatedTenantId: "tenant-impersonated",
  originalTenantId: "tenant-root",
};
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: vi.fn(() => ({
    setProjects,
    selectedProject: { itemId: "p-selected" },
    setTenantGroup: vi.fn(),
    setSelectedProject: vi.fn(),
  })),
  useImpersonateStore: vi.fn(() => impersonateState),
}));

vi.mock("@/services/project.service", () => ({
  projectService: { getProjects: vi.fn(), getProject: vi.fn() },
}));

vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService: {
    getAssets: vi.fn(),
    addAssets: vi.fn(),
    getEnvRepositories: vi.fn(),
    repoUpdate: vi.fn(),
    updateProject: vi.fn(),
    updateTenantGroup: vi.fn(),
    validateCNameProject: vi.fn(),
    disableProject: vi.fn(),
    createProject: vi.fn(),
    getMigrationStatus: vi.fn(),
    initiateMigration: vi.fn(),
    verifyMigration: vi.fn(),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

describe("use-project hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("useGetProjects", () => {
    it("fetches projects and flattens them into the store", async () => {
      vi.mocked(projectService.getProjects).mockResolvedValue([
        { projects: [{ itemId: "a" }] },
        { projects: [{ itemId: "b" }] },
      ] as never);

      const { result } = renderHook(
        () => useGetProjects({ tenantGroupId: "tg-1" }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(projectService.getProjects).toHaveBeenCalledWith(0, 100, "tg-1");
      await waitFor(() =>
        expect(setProjects).toHaveBeenCalledWith([
          { itemId: "a" },
          { itemId: "b" },
        ]),
      );
    });
  });

  describe("useGetProject", () => {
    it("fetches the project of the current auth context, without arguments", async () => {
      vi.mocked(projectService.getProject).mockResolvedValue({ itemId: "p-selected" } as never);
      const { result } = renderHook(() => useGetProject(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(projectService.getProject).toHaveBeenCalledWith();
    });

    it("stays idle until the impersonation state is known", async () => {
      impersonateState.isInitialized = false;
      vi.mocked(projectService.getProject).mockResolvedValue({ itemId: "p-x" } as never);
      const { result } = renderHook(() => useGetProject(), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
      expect(projectService.getProject).not.toHaveBeenCalled();
      impersonateState.isInitialized = true;
    });
  });

  describe("query hooks", () => {
    it("useGetAssets fetches assets by tenant group", async () => {
      vi.mocked(crossProjectService.getAssets).mockResolvedValue([] as never);
      const { result } = renderHook(() => useGetAssets("tg-1"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(crossProjectService.getAssets).toHaveBeenCalledWith("tg-1");
    });

    it("useGetEnvRepositories is disabled without a project key", () => {
      const { result } = renderHook(() => useGetEnvRepositories(""), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("useGetEnvRepositories fetches with a project key", async () => {
      vi.mocked(crossProjectService.getEnvRepositories).mockResolvedValue([] as never);
      const { result } = renderHook(() => useGetEnvRepositories("pk"), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(crossProjectService.getEnvRepositories).toHaveBeenCalledWith();
    });

    it("useGetMigrationStatus stays disabled until the migration feature is ready", () => {
      vi.mocked(crossProjectService.getMigrationStatus).mockResolvedValue({} as never);
      const { result } = renderHook(() => useGetMigrationStatus("tg"), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe("idle");
      expect(crossProjectService.getMigrationStatus).not.toHaveBeenCalled();
    });
  });

  describe("mutation hooks", () => {
    const cases: Array<{
      name: string;
      hook: () => { mutateAsync: (v: unknown) => Promise<unknown> };
      fn: ReturnType<typeof vi.fn>;
    }> = [
      { name: "useAddAssets", hook: useAddAssets, fn: vi.mocked(crossProjectService.addAssets) },
      {
        name: "useUpdateRepositories",
        hook: useUpdateRepositories,
        fn: vi.mocked(crossProjectService.repoUpdate),
      },
      {
        name: "useValidateCNameProject",
        hook: () => useValidateCNameProject({ projectKey: "pk" }),
        fn: vi.mocked(crossProjectService.validateCNameProject),
      },
      {
        name: "useDisableProject",
        hook: () => useDisableProject({ projectKey: "pk" }),
        fn: vi.mocked(crossProjectService.disableProject),
      },
      {
        name: "useCreateProject",
        hook: useCreateProject,
        fn: vi.mocked(crossProjectService.createProject),
      },
      {
        name: "useInitiateMigration",
        hook: useInitiateMigration,
        fn: vi.mocked(crossProjectService.initiateMigration),
      },
      {
        name: "useVerifyMigration",
        hook: useVerifyMigration,
        fn: vi.mocked(crossProjectService.verifyMigration),
      },
    ];

    it.each(cases)("$name calls its service", async ({ hook, fn }) => {
      fn.mockResolvedValue({ isSuccess: true } as never);
      const { result } = renderHook(hook, { wrapper: createWrapper() });
      await result.current.mutateAsync({ some: "payload" });
      expect(fn).toHaveBeenCalled();
    });

    it("useUpdateProject calls updateProject and useUpdateTenantGroup calls updateTenantGroup", async () => {
      vi.mocked(crossProjectService.updateProject).mockResolvedValue({} as never);
      vi.mocked(crossProjectService.updateTenantGroup).mockResolvedValue({} as never);

      const { result: r1 } = renderHook(() => useUpdateProject(), {
        wrapper: createWrapper(),
      });
      await r1.current.mutateAsync({ projectKey: "pk", name: "n", applicationDomain: "d" });

      const { result: r2 } = renderHook(() => useUpdateTenantGroup(), {
        wrapper: createWrapper(),
      });
      await r2.current.mutateAsync({ name: "n", tenantGroupId: "tg" });

      expect(crossProjectService.updateProject).toHaveBeenCalledTimes(1);
      expect(crossProjectService.updateProject).toHaveBeenCalledWith({
        projectKey: "pk",
        name: "n",
        applicationDomain: "d",
      });
      expect(crossProjectService.updateTenantGroup).toHaveBeenCalledTimes(1);
      expect(crossProjectService.updateTenantGroup).toHaveBeenCalledWith({
        name: "n",
        tenantGroupId: "tg",
      });
    });
  });
});
