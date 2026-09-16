import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import {
  mockStorageConfigList,
  mockSuccessResponse,
  mockDeleteSuccessResponse,
  mockSaveAmazonConfigPayload,
  mockSaveAzureConfigPayload,
  mockSaveSftpConfigPayload,
  mockSaveS3CompatibleConfigPayload,
  mockDeleteConfigPayload,
} from "../test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import type { IStorageConfigurationSavePayload } from "../models/storage.model";
import { StorageConfiguration } from "./storage-configuration.service";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";
import { STORAGE_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("StorageConfiguration", () => {
  let service: StorageConfiguration;

  beforeEach(() => {
    service = new StorageConfiguration();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── gets ──────────────────────────────────────────────────────────────────

  describe("gets", () => {
    it("should call the configs endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockStorageConfigList);

      const result = await service.gets();

      expect(http.get).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.GET_CONFIGS);
      expect(result).toEqual(mockStorageConfigList);
    });

    it("should return an empty array when no configs exist", async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      const result = await service.gets(TEST_PROJECT_KEY);

      expect(result).toEqual([]);
    });

    it("should handle API errors", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.gets(TEST_PROJECT_KEY)).rejects.toThrow("Network error");
    });
  });

  // ─── save ─────────────────────────────────────────────────────────────────

  describe("save", () => {
    it("should call correct endpoint for Amazon strategy and reset SFTP fields", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveAmazonConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG,
        expect.objectContaining({
          storageStrategy: "AWS",
          accessKey: mockSaveAmazonConfigPayload.accessKey,
          secretKey: mockSaveAmazonConfigPayload.secretKey,
          cloudStorageRegionEndPoint: mockSaveAmazonConfigPayload.cloudStorageRegionEndPoint,
          // SFTP-specific fields from payload override the reset defaults (null wins over "")
          host: null,
          port: null,
          userName: null,
          password: null,
          remoteBasePath: null,
          connectionString: null,
        }),
      );
    });

    it("should call correct endpoint for Azure strategy and reset credential fields", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveAzureConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG,
        expect.objectContaining({
          storageStrategy: "Azure",
          connectionString: mockSaveAzureConfigPayload.connectionString,
          // Credential fields from payload override the reset defaults (null wins over "")
          host: null,
          port: null,
          userName: null,
          password: null,
          accessKey: null,
          secretKey: null,
          cloudStorageRegionEndPoint: null,
        }),
      );
    });

    it("should call correct endpoint for SftpStorage strategy and reset cloud fields", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveSftpConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG,
        expect.objectContaining({
          storageStrategy: "SftpStorage",
          host: mockSaveSftpConfigPayload.host,
          port: mockSaveSftpConfigPayload.port,
          userName: mockSaveSftpConfigPayload.userName,
          password: mockSaveSftpConfigPayload.password,
          remoteBasePath: mockSaveSftpConfigPayload.remoteBasePath,
          // Cloud fields from payload override the reset defaults (null wins over "")
          accessKey: null,
          secretKey: null,
          cloudStorageRegionEndPoint: null,
          connectionString: null,
        }),
      );
    });

    it("should call correct endpoint for S3Compatible strategy and reset incompatible fields", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      await service.save(mockSaveS3CompatibleConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG,
        expect.objectContaining({
          storageStrategy: "S3Compatible",
          host: mockSaveS3CompatibleConfigPayload.host,
          accessKey: mockSaveS3CompatibleConfigPayload.accessKey,
          // Incompatible fields from payload override the reset defaults (null wins over "")
          port: null,
          userName: null,
          password: null,
          remoteBasePath: null,
          connectionString: null,
          cloudStorageRegionEndPoint: null,
        }),
      );
    });

    it("sends an update payload untouched, without padding provider fields back in", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload: IStorageConfigurationSavePayload = {
        projectKey: TEST_PROJECT_KEY,
        updateRequest: true,
        itemId: "config-1",
        uploadUrlExpirySeconds: 900,
        downloadUrlExpirySeconds: 120,
        maxFileSizeInBytes: 10_485_760,
        uploadCompletionRequiredFor: ["Private"],
      };
      await service.save(payload);

      // The per-provider blanking above exists to clear fields that don't belong to the provider
      // chosen at creation time. Letting it run on an update would put name/accessKey/secretKey/
      // connectionString back on the wire as empty strings - the exact properties an update is not
      // allowed to carry, and ones the server would have to defend itself against.
      expect(http.post).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG, payload);
      const sent = vi.mocked(http.post).mock.calls[0][1] as Record<string, unknown>;
      expect(Object.keys(sent).sort()).toEqual([
        "downloadUrlExpirySeconds",
        "itemId",
        "maxFileSizeInBytes",
        "projectKey",
        "updateRequest",
        "uploadCompletionRequiredFor",
        "uploadUrlExpirySeconds",
      ]);
    });

    it("should return the service response", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.save(mockSaveAmazonConfigPayload);

      expect(result).toEqual(mockSuccessResponse);
    });

    it("should handle API errors", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Failed to save config"));

      await expect(service.save(mockSaveAmazonConfigPayload)).rejects.toThrow(
        "Failed to save config",
      );
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("should call correct endpoint with projectKey and configurationName", async () => {
      vi.mocked(http.post).mockResolvedValue(mockDeleteSuccessResponse);

      const result = await service.delete(mockDeleteConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        `${STORAGE_CONFIG_ENDPOINTS.DELETE_CONFIG}?ProjectKey=${mockDeleteConfigPayload.projectKey}&ConfigurationName=${mockDeleteConfigPayload.configurationName}`,
        {},
      );
      expect(result).toEqual(mockDeleteSuccessResponse);
    });

    it("should send an empty body", async () => {
      vi.mocked(http.post).mockResolvedValue(mockDeleteSuccessResponse);

      await service.delete(mockDeleteConfigPayload);

      expect(http.post).toHaveBeenCalledWith(expect.any(String), {});
    });

    it("should handle API errors", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Failed to delete config"));

      await expect(service.delete(mockDeleteConfigPayload)).rejects.toThrow(
        "Failed to delete config",
      );
    });
  });
});
