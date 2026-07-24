import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { useProjectForm } from "./use-project";

// Hoisted so the vi.mock factories below (which run at import time) can safely
// reference these mocks without hitting a temporal-dead-zone error.
const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  resetFormData: vi.fn(),
  setTenantGroup: vi.fn(),
  setSelectedProject: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
  formData: undefined as unknown,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => h.navigate,
}));

vi.mock("@/components/create-project/utils", () => ({
  useCreateProjectFormState: () => ({
    formData: h.formData,
    resetFormData: h.resetFormData,
  }),
  shortGuidGenerator: () => "abcde",
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({
    setTenantGroup: h.setTenantGroup,
    setSelectedProject: h.setSelectedProject,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: h.showSuccessToast,
  showErrorToast: h.showErrorToast,
}));

vi.mock("@/services/project.service", () => ({
  projectService: { getProjects: h.getProjects },
}));

vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService: { createProject: h.createProject },
}));

describe("useProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.formData = [
      {
        name: "My Project",
        isAcceptBlocksTerms: true,
        isUseBlocksExclusively: false,
      },
      {
        assets: [
          {
            full_name: "org/repo",
            html_url: "https://github.com/org/repo",
            id: 42,
          },
        ],
      },
      { environments: [{ value: "main" }, { value: "dev" }] },
    ];
  });

  it("creates the project, selects the first project and navigates on success", async () => {
    h.createProject.mockResolvedValue({
      isSuccess: true,
      tenantGroupId: "tg-1",
      errors: null,
    });
    h.getProjects.mockResolvedValue([
      { projects: [{ itemId: "p-1", name: "First" }] },
    ]);

    const { result } = renderHook(() => useProjectForm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveProject();
    });

    expect(h.createProject).toHaveBeenCalledTimes(1);
    expect(h.createProject.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        name: "My Project",
        isAcceptBlocksTerms: true,
        isUseBlocksExclusively: false,
        resources: [
          {
            name: "org/repo",
            link: "https://github.com/org/repo",
            resourceId: "42",
          },
        ],
      }),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Your project has been created.",
    });
    expect(h.setTenantGroup).toHaveBeenCalledWith("tg-1");
    expect(h.getProjects).toHaveBeenCalledWith(0, 100, "tg-1");
    expect(h.setSelectedProject).toHaveBeenCalledWith({
      itemId: "p-1",
      name: "First",
    });
    expect(h.navigate).toHaveBeenCalledWith("/app/project/tg-1/environments");
    expect(h.resetFormData).toHaveBeenCalledTimes(1);
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast and does not navigate when isSuccess is false", async () => {
    h.createProject.mockResolvedValue({
      isSuccess: false,
      errors: { general: "nope" },
    });

    const { result } = renderHook(() => useProjectForm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveProject();
    });

    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: { general: "nope" },
    });
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(h.setTenantGroup).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.resetFormData).not.toHaveBeenCalled();
  });

  it("handles a thrown error carrying an `errors` property", async () => {
    h.createProject.mockRejectedValue({ errors: { field: "bad" } });

    const { result } = renderHook(() => useProjectForm(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveProject();
    });

    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: { field: "bad" },
    });
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.resetFormData).not.toHaveBeenCalled();
  });
});
