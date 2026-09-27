import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { RoleService } from "./role.service";
import { ROLE_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockGetRolesPayload,
  mockRolesResponse,
  mockGetRolePayload,
  mockGetRoleResponse,
  mockCreateRolePayload,
  mockRole,
  mockUpdateRolePayload,
  mockSetRolesPayload,
  mockSuccessResponse,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("RoleService", () => {
  let service: RoleService;

  beforeEach(() => {
    service = new RoleService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getRoles ─────────────────────────────────────────────────────────────
  describe("getRoles", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockRolesResponse);

      const result = await service.getRoles(mockGetRolesPayload);

      expect(http.post).toHaveBeenCalledWith(
        ROLE_ENDPOINTS.GET_ROLES,
        { ...mockGetRolesPayload, filter: { search: "" } },
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockRolesResponse);
    });

    it("sends organizationId and drops projectKey", async () => {
      // projectKey is not on IAM's request model, so sending it only made the body
      // look organization-aware. organizationId is what actually scopes the query.
      vi.mocked(http.post).mockResolvedValue(mockRolesResponse);

      await service.getRoles({
        page: 0,
        pageSize: 10,
        projectKey: "tenant-1",
        organizationId: "org-1",
        filter: { search: "man" },
      });

      const body = vi.mocked(http.post).mock.calls[0][1] as Record<string, unknown>;
      expect(body).not.toHaveProperty("projectKey");
      expect(body.organizationId).toBe("org-1");
    });

    it("always sends a search string, even for a slugs-only filter", async () => {
      // IAM rejected a slugs-only body with
      // { "Filter.Search": ["The Search field is required."] }, which broke the bulk
      // role dialog's held-role lookup outright.
      vi.mocked(http.post).mockResolvedValue(mockRolesResponse);

      await service.getRoles({
        page: 0,
        pageSize: 5,
        organizationId: "org-1",
        filter: { slugs: ["manager", "clouduser"] },
      });

      const body = vi.mocked(http.post).mock.calls[0][1] as { filter: Record<string, unknown> };
      expect(body.filter).toEqual({ slugs: ["manager", "clouduser"], search: "" });
    });

    it("does not overwrite a search the caller supplied", async () => {
      vi.mocked(http.post).mockResolvedValue(mockRolesResponse);

      await service.getRoles({ page: 0, pageSize: 5, filter: { search: "admin" } });

      const body = vi.mocked(http.post).mock.calls[0][1] as { filter: Record<string, unknown> };
      expect(body.filter.search).toBe("admin");
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.getRoles(mockGetRolesPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── getRoleById ──────────────────────────────────────────────────────────
  describe("getRoleById", () => {
    it("should GET role by id without query params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockGetRoleResponse);

      const result = await service.getRoleById(mockGetRolePayload);

      expect(http.get).toHaveBeenCalledWith(
        `${ROLE_ENDPOINTS.GET_ROLES}/${mockGetRolePayload.id}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockGetRoleResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getRoleById(mockGetRolePayload)).rejects.toThrow("Network error");
    });
  });

  // ─── addRole ──────────────────────────────────────────────────────────────
  describe("addRole", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockRole);

      const result = await service.addRole(mockCreateRolePayload);

      expect(http.post).toHaveBeenCalledWith(
        ROLE_ENDPOINTS.CREATE_ROLE,
        mockCreateRolePayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockRole);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.addRole(mockCreateRolePayload)).rejects.toThrow("Network error");
    });
  });

  // ─── updateRole ───────────────────────────────────────────────────────────
  describe("updateRole", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.updateRole(mockUpdateRolePayload);

      expect(http.post).toHaveBeenCalledWith(
        ROLE_ENDPOINTS.UPDATE_ROLE,
        mockUpdateRolePayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.updateRole(mockUpdateRolePayload)).rejects.toThrow("Network error");
    });
  });

  // ─── setRoles ─────────────────────────────────────────────────────────────
  describe("setRoles", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSetRolesPayload);

      const result = await service.setRoles(mockSetRolesPayload);

      expect(http.post).toHaveBeenCalledWith(
        ROLE_ENDPOINTS.SET_ROLES,
        { ...mockSetRolesPayload },
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSetRolesPayload);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.setRoles(mockSetRolesPayload)).rejects.toThrow("Network error");
    });
  });
});
