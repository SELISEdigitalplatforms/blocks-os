import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { AuthOidc } from "./auth-clients-oidc.service";
import { AUTH_OIDC_ENDPOINTS, AUTH_OIDC_TEMPLATE_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockGetOidcPayload,
  mockOidcCredentialsResponse,
  mockOidcCredentialResponse,
  mockSaveOidcPayload,
  mockDeleteClientPayload,
  mockRotateOidcSecretPayload,
  mockRotateOidcSecretResponse,
  mockSuccessResponse,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("AuthOidc", () => {
  let service: AuthOidc;

  beforeEach(() => {
    service = new AuthOidc();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getOidcCredentials ───────────────────────────────────────────────────
  describe("getOidcCredentials", () => {
    it("should GET with correct query params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockOidcCredentialsResponse);

      const result = await service.getOidcCredentials(mockGetOidcPayload);

      expect(http.get).toHaveBeenCalledWith(AUTH_OIDC_ENDPOINTS.GET_OIDC_CLIENTS, undefined, {
        absoluteUrl: true,
      });
      expect(result).toEqual(mockOidcCredentialsResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getOidcCredentials(mockGetOidcPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── getOidcCredential ────────────────────────────────────────────────────
  describe("getOidcCredential", () => {
    it("should GET with projectKey and clientId query params", async () => {
      const payload = { ...mockGetOidcPayload, clientId: "test-client-id" };
      vi.mocked(http.get).mockResolvedValue(mockOidcCredentialResponse);

      const result = await service.getOidcCredential(payload);

      expect(http.get).toHaveBeenCalledWith(
        `${AUTH_OIDC_ENDPOINTS.GET_OIDC_CLIENT}/${payload.clientId}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockOidcCredentialResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(
        service.getOidcCredential({ ...mockGetOidcPayload, clientId: "test-client-id" }),
      ).rejects.toThrow("Network error");
    });
  });

  // ─── saveOidcCredential ───────────────────────────────────────────────────
  describe("saveOidcCredential", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.saveOidcCredential(mockSaveOidcPayload);

      expect(http.post).toHaveBeenCalledWith(
        AUTH_OIDC_ENDPOINTS.SAVE_OIDC_CLIENT,
        mockSaveOidcPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.saveOidcCredential(mockSaveOidcPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── deleteOidcCredential ─────────────────────────────────────────────────
  describe("deleteOidcCredential", () => {
    it("should DELETE the correct endpoint with itemId in the URL", async () => {
      vi.mocked(http.delete).mockResolvedValue(mockSuccessResponse);

      const result = await service.deleteOidcCredential(mockDeleteClientPayload);

      expect(http.delete).toHaveBeenCalledWith(
        `${AUTH_OIDC_ENDPOINTS.DELETE_OIDC_CLIENT}/${mockDeleteClientPayload.itemId}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.delete).mockRejectedValue(new Error("Network error"));

      await expect(service.deleteOidcCredential(mockDeleteClientPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("rotateOidcClientSecret", () => {
    it("should POST to the rotate-secret endpoint with empty body", async () => {
      vi.mocked(http.post).mockResolvedValue(mockRotateOidcSecretResponse);

      const result = await service.rotateOidcClientSecret(mockRotateOidcSecretPayload);

      expect(http.post).toHaveBeenCalledWith(
        `${AUTH_OIDC_ENDPOINTS.ROTATE_OIDC_CLIENT_SECRET}/${mockRotateOidcSecretPayload.itemId}/rotate-secret`,
        {},
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockRotateOidcSecretResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.rotateOidcClientSecret(mockRotateOidcSecretPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("getOidcTemplate", () => {
    it("GETs and unwraps the tenant-level template response", async () => {
      const template = { branding: { brandName: "Blocks IAM", logoUrl: null } };
      vi.mocked(http.get).mockResolvedValue({ template });

      const result = await service.getOidcTemplate();

      expect(http.get).toHaveBeenCalledWith(
        AUTH_OIDC_TEMPLATE_ENDPOINTS.GET_OIDC_TEMPLATE,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toBe(template);
    });

    it("returns null when the tenant has no saved template", async () => {
      vi.mocked(http.get).mockResolvedValue({ template: null });

      await expect(service.getOidcTemplate()).resolves.toBeNull();
    });
  });

  describe("saveOidcTemplate", () => {
    it("PUTs the complete tenant-level template", async () => {
      const template = { branding: { brandName: "Blocks IAM", logoUrl: null } };
      const response = { isSuccess: true, itemId: "template-1" };
      vi.mocked(http.put).mockResolvedValue(response);

      const result = await service.saveOidcTemplate(template as never);

      expect(http.put).toHaveBeenCalledWith(
        AUTH_OIDC_TEMPLATE_ENDPOINTS.SAVE_OIDC_TEMPLATE,
        template,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toBe(response);
    });
  });
});
