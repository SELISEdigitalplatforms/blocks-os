import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { modelService } from "@blocks-ai/services/aimodel.service";
import {
  useCreateModel,
  useGetModels,
  useGetAllModels,
  useGetModelById,
  useUpdateModel,
  useDeleteModel,
  useValidateModel,
  useSeedProviders,
  useSeedModelsByProvider,
} from "./use-aimodel";

vi.mock("@blocks-ai/services/aimodel.service", () => ({
  modelService: {
    createModel: vi.fn(),
    getModels: vi.fn(),
    getAllModels: vi.fn(),
    getModelById: vi.fn(),
    updateModel: vi.fn(),
    deleteModel: vi.fn(),
    validateModel: vi.fn(),
    getSeedProviders: vi.fn(),
    getSeedModelsByProvider: vi.fn(),
  },
}));

describe("use-aimodel hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetModels fetches models", async () => {
    vi.mocked(modelService.getModels).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetModels({ provider: "openai" } as never, "pk"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelService.getModels).toHaveBeenCalledWith({ provider: "openai" }, "pk");
  });

  it("useGetAllModels fetches all models", async () => {
    vi.mocked(modelService.getAllModels).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetAllModels({} as never, "pk"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelService.getAllModels).toHaveBeenCalled();
  });

  it("useGetModelById is disabled without a model id", () => {
    const { result } = renderHook(() => useGetModelById("", "pk"), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetModelById fetches by id", async () => {
    vi.mocked(modelService.getModelById).mockResolvedValue({} as never);
    const { result } = renderHook(() => useGetModelById("m-1", "pk"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelService.getModelById).toHaveBeenCalledWith("m-1", "pk");
  });

  it("useSeedProviders fetches providers", async () => {
    vi.mocked(modelService.getSeedProviders).mockResolvedValue([] as never);
    const { result } = renderHook(() => useSeedProviders(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(modelService.getSeedProviders).toHaveBeenCalled();
  });

  it("useSeedModelsByProvider is disabled without a provider", () => {
    const { result } = renderHook(() => useSeedModelsByProvider(""), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useCreateModel creates a model", async () => {
    vi.mocked(modelService.createModel).mockResolvedValue({} as never);
    const { result } = renderHook(() => useCreateModel(), { wrapper: createWrapper() });
    await result.current.mutateAsync({} as never);
    expect(modelService.createModel).toHaveBeenCalled();
  });

  it("useUpdateModel updates a model", async () => {
    vi.mocked(modelService.updateModel).mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateModel(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ modelId: "m-1", payload: {} as never });
    expect(modelService.updateModel).toHaveBeenCalledWith("m-1", {});
  });

  it("useDeleteModel invalidates only when deletion succeeded", async () => {
    vi.mocked(modelService.deleteModel).mockResolvedValue({ is_success: true } as never);
    const { result } = renderHook(() => useDeleteModel(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ modelId: "m-1", project_key: "pk" });
    expect(modelService.deleteModel).toHaveBeenCalledWith("m-1", "pk");
  });

  it("useValidateModel validates a model", async () => {
    vi.mocked(modelService.validateModel).mockResolvedValue({} as never);
    const { result } = renderHook(() => useValidateModel(), { wrapper: createWrapper() });
    await result.current.mutateAsync({ modelId: "m-1", project_key: "pk" });
    expect(modelService.validateModel).toHaveBeenCalledWith("m-1", "pk");
  });
});
