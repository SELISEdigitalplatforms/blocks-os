import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { AuthClientsService } from "./auth-clients.service";
import { AUTH_CLIENT_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockGetClientsPayload,
  mockClientCredentialsResponse,
  mockSaveClientPayload,
  mockDeleteClientPayload,
  mockSuccessResponse,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("AuthClientsService", () => {
  let service: AuthClientsService;

  beforeEach(() => {
    service = new AuthClientsService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────────────────
  describe("list", () => {
    it("should GET the new client-credentials endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockClientCredentialsResponse);

      const result = await service.list(mockGetClientsPayload);

      expect(http.get).toHaveBeenCalledWith(
        AUTH_CLIENT_ENDPOINTS.LIST,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockClientCredentialsResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.list(mockGetClientsPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── save ──────────────────────────────────────────────────────────────────
  describe("save", () => {
    it("should POST to the client-credentials endpoint with the new payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.save(mockSaveClientPayload);

      expect(http.post).toHaveBeenCalledWith(
        AUTH_CLIENT_ENDPOINTS.SAVE,
        mockSaveClientPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.save(mockSaveClientPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────
  describe("delete", () => {
    it("should DELETE the resource by itemId in the path", async () => {
      vi.mocked(http.delete).mockResolvedValue(mockSuccessResponse);

      const result = await service.delete({ itemId: mockDeleteClientPayload.itemId });

      expect(http.delete).toHaveBeenCalledWith(
        `${AUTH_CLIENT_ENDPOINTS.DELETE}/${mockDeleteClientPayload.itemId}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.delete).mockRejectedValue(new Error("Network error"));

      await expect(
        service.delete({ itemId: mockDeleteClientPayload.itemId }),
      ).rejects.toThrow("Network error");
    });
  });
});
