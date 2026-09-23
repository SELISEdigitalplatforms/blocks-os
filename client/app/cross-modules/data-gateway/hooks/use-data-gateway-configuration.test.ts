import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockDataGatewayConfig,
  mockDataGatewayServiceFactory,
  mockSaveCreatePayload,
  mockSuccessResponse,
} from "../test-utils/__mocks__";
import { dataGatewayService } from "@/cross-modules/data-gateway/services/data-gateway.service";
import {
  useGetDataGatewayConfiguration,
  useSaveDataGatewayConfiguration,
} from "./use-data-gateway-configuration";

const mockGetState = vi.fn(() => ({
  selectedProject: { tenantId: "t1", tenantSlug: "slug1" },
}));
vi.mock("@seliseblocks/genesis-os", () => {
  const useProjectStore = () => mockGetState();
  (useProjectStore as unknown as { getState: () => unknown }).getState = () => mockGetState();
  return { useProjectStore };
});

vi.mock("@/cross-modules/data-gateway/services/data-gateway.service", () =>
  mockDataGatewayServiceFactory(),
);

describe("DataGateway Configuration Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetState.mockReturnValue({ selectedProject: { tenantId: "t1", tenantSlug: "slug1" } });
  });

  // ─── useGetDataGatewayConfiguration ────────────────────────────────────────
  // There is at most one configuration - no project key is sent, the ambient tenant decides it.

  describe("useGetDataGatewayConfiguration", () => {
    it("should fetch the single configuration", async () => {
      vi.mocked(dataGatewayService.configuration.get).mockResolvedValue(mockDataGatewayConfig);

      const { result } = renderHook(() => useGetDataGatewayConfiguration(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(dataGatewayService.configuration.get).toHaveBeenCalledWith();
      expect(result.current.data).toEqual(mockDataGatewayConfig);
    });

    it("should resolve to null/undefined when none exists yet", async () => {
      vi.mocked(dataGatewayService.configuration.get).mockResolvedValue(
        null as unknown as typeof mockDataGatewayConfig,
      );

      const { result } = renderHook(() => useGetDataGatewayConfiguration(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it("should handle errors", async () => {
      vi.mocked(dataGatewayService.configuration.get).mockRejectedValue(
        new Error("Failed to fetch config"),
      );

      const { result } = renderHook(() => useGetDataGatewayConfiguration(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  // ─── useSaveDataGatewayConfiguration ────────────────────────────────────────

  describe("useSaveDataGatewayConfiguration", () => {
    it("should save a data gateway configuration successfully", async () => {
      vi.mocked(dataGatewayService.configuration.save).mockResolvedValue(mockSuccessResponse);

      const { result } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(dataGatewayService.configuration.save).toHaveBeenCalledWith(
        mockSaveCreatePayload,
        expect.anything(),
      );
      expect(result.current.data).toEqual(mockSuccessResponse);
    });

    it("should invalidate the configuration on success", async () => {
      vi.mocked(dataGatewayService.configuration.save).mockResolvedValue(mockSuccessResponse);
      vi.mocked(dataGatewayService.configuration.get).mockResolvedValue(mockDataGatewayConfig);

      const wrapper = createWrapper();

      const { result: getResult } = renderHook(() => useGetDataGatewayConfiguration(), {
        wrapper,
      });
      await waitFor(() => expect(getResult.current.isSuccess).toBe(true));

      const { result: saveResult } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper,
      });
      saveResult.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(saveResult.current.isSuccess).toBe(true));

      await waitFor(() => {
        expect(dataGatewayService.configuration.get).toHaveBeenCalledTimes(2);
      });
    });

    it("should not invalidate the query when isSuccess is false", async () => {
      const failResponse = { errors: { connectionString: "required" }, isSuccess: false };
      vi.mocked(dataGatewayService.configuration.save).mockResolvedValue(failResponse);
      vi.mocked(dataGatewayService.configuration.get).mockResolvedValue(mockDataGatewayConfig);

      const wrapper = createWrapper();

      const { result: getResult } = renderHook(() => useGetDataGatewayConfiguration(), {
        wrapper,
      });
      await waitFor(() => expect(getResult.current.isSuccess).toBe(true));

      const { result: saveResult } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper,
      });
      saveResult.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(saveResult.current.isSuccess).toBe(true));

      expect(dataGatewayService.configuration.get).toHaveBeenCalledTimes(1);
    });

    it("should handle save errors", async () => {
      vi.mocked(dataGatewayService.configuration.save).mockRejectedValue(
        new Error("Failed to save config"),
      );

      const { result } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(
        expect.objectContaining({ message: "Failed to save config" }),
      );
    });
  });
});
