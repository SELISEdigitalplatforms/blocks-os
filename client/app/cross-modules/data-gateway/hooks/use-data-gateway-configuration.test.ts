import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockDataGatewayConfigList,
  mockDataGatewayConfig,
  mockDataGatewayServiceFactory,
  mockSaveCreatePayload,
  mockSuccessResponse,
} from "../test-utils/__mocks__";
import { dataGatewayService } from "@/cross-modules/data-gateway/services/data-gateway.service";
import {
  useGetDataGatewayConfigurations,
  useGetDataGatewayConfiguration,
  useSaveDataGatewayConfiguration,
} from "./use-data-gateway-configuration";

vi.mock("@/cross-modules/data-gateway/services/data-gateway.service", () =>
  mockDataGatewayServiceFactory(),
);

describe("DataGateway Configuration Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── useGetDataGatewayConfigurations ───────────────────────────────────────

  describe("useGetDataGatewayConfigurations", () => {
    it("should fetch data gateway configurations successfully", async () => {
      vi.mocked(dataGatewayService.configuration.gets).mockResolvedValue(
        mockDataGatewayConfigList,
      );

      const { result } = renderHook(() => useGetDataGatewayConfigurations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockDataGatewayConfigList);
      expect(dataGatewayService.configuration.gets).toHaveBeenCalledWith();
    });

    it("should return empty array when no configs exist", async () => {
      vi.mocked(dataGatewayService.configuration.gets).mockResolvedValue([]);

      const { result } = renderHook(() => useGetDataGatewayConfigurations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });

    it("should handle errors", async () => {
      vi.mocked(dataGatewayService.configuration.gets).mockRejectedValue(
        new Error("Failed to fetch configs"),
      );

      const { result } = renderHook(() => useGetDataGatewayConfigurations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  // ─── useGetDataGatewayConfiguration ────────────────────────────────────────

  describe("useGetDataGatewayConfiguration", () => {
    it("should fetch a single configuration by project key", async () => {
      vi.mocked(dataGatewayService.configuration.get).mockResolvedValue(mockDataGatewayConfig);

      const { result } = renderHook(
        () => useGetDataGatewayConfiguration({ projectKey: "project-key-1" }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(dataGatewayService.configuration.get).toHaveBeenCalledWith("project-key-1");
      expect(result.current.data).toEqual(mockDataGatewayConfig);
    });

    it("should not query when the project key is blank", () => {
      renderHook(() => useGetDataGatewayConfiguration({ projectKey: "" }), {
        wrapper: createWrapper(),
      });

      expect(dataGatewayService.configuration.get).not.toHaveBeenCalled();
    });

    it("should respect an explicit enabled override", () => {
      renderHook(
        () =>
          useGetDataGatewayConfiguration(
            { projectKey: "project-key-1" },
            { enabled: false },
          ),
        { wrapper: createWrapper() },
      );

      expect(dataGatewayService.configuration.get).not.toHaveBeenCalled();
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

    it("should invalidate the configurations list on success", async () => {
      vi.mocked(dataGatewayService.configuration.save).mockResolvedValue(mockSuccessResponse);
      vi.mocked(dataGatewayService.configuration.gets).mockResolvedValue(
        mockDataGatewayConfigList,
      );

      const wrapper = createWrapper();

      const { result: configsResult } = renderHook(() => useGetDataGatewayConfigurations(), {
        wrapper,
      });
      await waitFor(() => expect(configsResult.current.isSuccess).toBe(true));

      const { result: saveResult } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper,
      });
      saveResult.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(saveResult.current.isSuccess).toBe(true));

      await waitFor(() => {
        expect(dataGatewayService.configuration.gets).toHaveBeenCalledTimes(2);
      });
    });

    it("should not invalidate the query when isSuccess is false", async () => {
      const failResponse = { errors: { projectKey: "duplicate" }, isSuccess: false };
      vi.mocked(dataGatewayService.configuration.save).mockResolvedValue(failResponse);
      vi.mocked(dataGatewayService.configuration.gets).mockResolvedValue(
        mockDataGatewayConfigList,
      );

      const wrapper = createWrapper();

      const { result: configsResult } = renderHook(() => useGetDataGatewayConfigurations(), {
        wrapper,
      });
      await waitFor(() => expect(configsResult.current.isSuccess).toBe(true));

      const { result: saveResult } = renderHook(() => useSaveDataGatewayConfiguration(), {
        wrapper,
      });
      saveResult.current.mutate(mockSaveCreatePayload);

      await waitFor(() => expect(saveResult.current.isSuccess).toBe(true));

      expect(dataGatewayService.configuration.gets).toHaveBeenCalledTimes(1);
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
