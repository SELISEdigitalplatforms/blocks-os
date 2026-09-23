import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import {
  mockDataGatewayConfigList,
  mockDataGatewayConfig,
  mockSuccessResponse,
  mockSaveCreatePayload,
  mockSaveUpdatePayload,
} from "../test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { DataGatewayConfiguration } from "./data-gateway-configuration.service";
import { DATA_GATEWAY_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("DataGatewayConfiguration", () => {
  let service: DataGatewayConfiguration;

  beforeEach(() => {
    service = new DataGatewayConfiguration();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── gets ──────────────────────────────────────────────────────────────────

  describe("gets", () => {
    it("should call the configs endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockDataGatewayConfigList);

      const result = await service.gets();

      expect(http.get).toHaveBeenCalledWith(DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIGS);
      expect(result).toEqual(mockDataGatewayConfigList);
    });

    it("should return an empty array when no configs exist", async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      const result = await service.gets();

      expect(result).toEqual([]);
    });

    it("should handle API errors", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.gets()).rejects.toThrow("Network error");
    });
  });

  // ─── get ───────────────────────────────────────────────────────────────────

  describe("get", () => {
    it("should call the config endpoint with the ProjectKey query param", async () => {
      vi.mocked(http.get).mockResolvedValue(mockDataGatewayConfig);

      const result = await service.get("project-key-1");

      expect(http.get).toHaveBeenCalledWith(
        `${DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=project-key-1`,
      );
      expect(result).toEqual(mockDataGatewayConfig);
    });

    it("should encode the project key", async () => {
      vi.mocked(http.get).mockResolvedValue(mockDataGatewayConfig);

      await service.get("project key/with special&chars");

      expect(http.get).toHaveBeenCalledWith(
        `${DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=project%20key%2Fwith%20special%26chars`,
      );
    });

    it("should handle API errors", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Not found"));

      await expect(service.get("missing")).rejects.toThrow("Not found");
    });
  });

  // ─── save ─────────────────────────────────────────────────────────────────

  describe("save", () => {
    it("should call the save endpoint with a create payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveCreatePayload);

      expect(http.post).toHaveBeenCalledWith(
        DATA_GATEWAY_CONFIG_ENDPOINTS.SAVE_CONFIG,
        mockSaveCreatePayload,
      );
    });

    it("should call the save endpoint with an update payload untouched", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveUpdatePayload);

      expect(http.post).toHaveBeenCalledWith(
        DATA_GATEWAY_CONFIG_ENDPOINTS.SAVE_CONFIG,
        mockSaveUpdatePayload,
      );
    });

    it("should return the service response", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.save(mockSaveCreatePayload);

      expect(result).toEqual(mockSuccessResponse);
    });

    it("should handle API errors", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Failed to save config"));

      await expect(service.save(mockSaveCreatePayload)).rejects.toThrow("Failed to save config");
    });
  });
});
