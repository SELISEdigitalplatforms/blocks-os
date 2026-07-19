import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { OrganizationService } from "./organization.service";
import { ORGANIZATION_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockGetOrganizationsPayload,
  mockOrganizationsResponse,
  mockGetOrganizationByIdPayload,
  mockGetOrganizationByIdResponse,
  mockSaveOrganizationPayload,
  mockOrganizationConfigResponse,
  mockSaveOrganizationConfigPayload,
  mockSuccessResponse,
} from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("OrganizationService", () => {
  let service: OrganizationService;

  beforeEach(() => {
    service = new OrganizationService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getOrganizations ─────────────────────────────────────────────────────
  describe("getOrganizations", () => {
    it("should GET with correct query params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockOrganizationsResponse);

      const result = await service.getOrganizations(mockGetOrganizationsPayload);

      expect(http.get).toHaveBeenCalledWith(
        `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATIONS}?projectKey=${mockGetOrganizationsPayload.projectKey}&page=${mockGetOrganizationsPayload.page}&pageSize=${mockGetOrganizationsPayload.pageSize}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockOrganizationsResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getOrganizations(mockGetOrganizationsPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── getOrganizationById ──────────────────────────────────────────────────
  describe("getOrganizationById", () => {
    it("should GET with correct query params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockGetOrganizationByIdResponse);

      const result = await service.getOrganizationById(mockGetOrganizationByIdPayload);

      expect(http.get).toHaveBeenCalledWith(
        `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATION}?ProjectKey=${mockGetOrganizationByIdPayload.projectKey}&ItemId=${mockGetOrganizationByIdPayload.itemId}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockGetOrganizationByIdResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getOrganizationById(mockGetOrganizationByIdPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── saveOrganization ─────────────────────────────────────────────────────
  describe("saveOrganization", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.saveOrganization(mockSaveOrganizationPayload);

      expect(http.post).toHaveBeenCalledWith(
        ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION,
        mockSaveOrganizationPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.saveOrganization(mockSaveOrganizationPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── getOrganizationConfig ────────────────────────────────────────────────
  describe("getOrganizationConfig", () => {
    it("should GET without query params and map the response", async () => {
      vi.mocked(http.get).mockResolvedValue({
        AllowOrgCreationFromCloud: true,
        AllowOrgCreationFromConstruct: false,
        IsMultiOrgEnabled: false,
        ItemId: "org-config-001",
      });

      const result = await service.getOrganizationConfig(TEST_PROJECT_KEY);

      expect(http.get).toHaveBeenCalledWith(
        ORGANIZATION_ENDPOINTS.GET_ORGANIZATION_CONFIG,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual({
        itemId: "org-config-001",
        createdDate: "",
        lastUpdatedDate: "",
        createdBy: "",
        language: "",
        lastUpdatedBy: "",
        organizationIds: [],
        tags: [],
        allowCreationFromCloud: true,
        allowCreationFromConstruct: false,
        isMultiOrgEnabled: false,
        consentForMultiOrgEnable: false,
        allowOrgCreationFromSignup: false,
        allowOrgCreationFromPortal: false,
        defaultRoleOnOrgCreation: [],
        defaultPermissionOnOrgCreation: [],
        keepOrgRolesSameAsDefaultRoles: true,
        keepOrgPermissionsSameAsDefaultPermissions: true,
      });
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getOrganizationConfig(TEST_PROJECT_KEY)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── saveOrganizationConfig ───────────────────────────────────────────────
  describe("saveOrganizationConfig", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.saveOrganizationConfig(mockSaveOrganizationConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION_CONFIG,
        {
          allowOrgCreationFromCloud: true,
          allowOrgCreationFromConstruct: false,
          allowOrgCreationFromSignup: false,
          allowOrgCreationFromPortal: false,
          isMultiOrgEnabled: false,
          defaultRolesOnOrgCreation: [],
          defaultPermissionsOnOrgCreation: [],
          keepOrgRolesSameAsDefaultRoles: true,
          keepOrgPermissionsSameAsDefaultPermissions: true,
        },
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(
        service.saveOrganizationConfig(mockSaveOrganizationConfigPayload),
      ).rejects.toThrow("Network error");
    });
  });
});
