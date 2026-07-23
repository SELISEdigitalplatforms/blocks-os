import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { apiSettingsService } from "../services/api-settings.service";
import {
  useGetApiEndpoints,
  useGetApiEndpointsInfinite,
  useUpdateApiEndpoint,
  useBulkUpdateApiEndpoints,
  useRemoveApiEndpoints,
} from "./use-api-settings";

vi.mock("../services/api-settings.service", () => ({
  apiSettingsService: {
    getEndpoints: vi.fn(),
    updateEndpoint: vi.fn(),
    bulkUpdate: vi.fn(),
    removeEndpoints: vi.fn(),
  },
}));

const page = (p: number, totalPages: number) => ({
  page: p,
  pageSize: 20,
  totalPages,
  totalCount: 40,
  data: [],
  errors: null,
});

describe("use-api-settings hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetApiEndpoints is disabled without a project key", () => {
    const { result } = renderHook(() => useGetApiEndpoints({ projectKey: "" }), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetApiEndpoints fetches with a project key", async () => {
    vi.mocked(apiSettingsService.getEndpoints).mockResolvedValue(page(0, 1) as never);
    const options = { projectKey: "pk", page: 0, pageSize: 20 };
    const { result } = renderHook(() => useGetApiEndpoints(options), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiSettingsService.getEndpoints).toHaveBeenCalledWith(options);
  });

  describe("useGetApiEndpointsInfinite", () => {
    it("computes the next page while more pages remain", async () => {
      vi.mocked(apiSettingsService.getEndpoints).mockResolvedValue(page(0, 3) as never);
      const { result } = renderHook(
        () => useGetApiEndpointsInfinite({ projectKey: "pk", filter: {} }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(true);
    });

    it("stops paginating on the last page", async () => {
      vi.mocked(apiSettingsService.getEndpoints).mockResolvedValue(page(0, 1) as never);
      const { result } = renderHook(
        () => useGetApiEndpointsInfinite({ projectKey: "pk", filter: {} }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
    });
  });

  it("useUpdateApiEndpoint updates an endpoint", async () => {
    vi.mocked(apiSettingsService.updateEndpoint).mockResolvedValue({} as never);
    const { result } = renderHook(() => useUpdateApiEndpoint(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ itemId: "e-1" } as never);
    expect(apiSettingsService.updateEndpoint).toHaveBeenCalled();
  });

  it("useBulkUpdateApiEndpoints bulk updates", async () => {
    vi.mocked(apiSettingsService.bulkUpdate).mockResolvedValue({} as never);
    const { result } = renderHook(() => useBulkUpdateApiEndpoints(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(apiSettingsService.bulkUpdate).toHaveBeenCalled();
  });

  it("useRemoveApiEndpoints removes endpoints", async () => {
    vi.mocked(apiSettingsService.removeEndpoints).mockResolvedValue({} as never);
    const { result } = renderHook(() => useRemoveApiEndpoints(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(apiSettingsService.removeEndpoints).toHaveBeenCalled();
  });
});
