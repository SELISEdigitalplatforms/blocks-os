import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { iamService } from "./iam.service";
import { PermissionService } from "./permission.service";
import { OrganizationService } from "./organization.service";
import {
  ORGANIZATION_ENDPOINTS,
  PERMISSION_ENDPOINTS,
} from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("iamService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("composes permission and organization services", () => {
    expect(iamService.permission).toBeInstanceOf(PermissionService);
    expect(iamService.organization).toBeInstanceOf(OrganizationService);
  });

  it("permission.getPermissions delegates to http.post with absolute url", async () => {
    vi.mocked(http.post).mockResolvedValue({ data: [], totalCount: 0 } as never);
    const payload = { page: 1, pageSize: 20 } as never;
    await iamService.permission.getPermissions(payload);
    expect(http.post).toHaveBeenCalledWith(
      PERMISSION_ENDPOINTS.GET_PERMISSIONS,
      payload,
      undefined,
      ABS,
    );
  });

  it("organization.getOrganizations builds a paged query", async () => {
    vi.mocked(http.get).mockResolvedValue({ organizations: [] } as never);
    await iamService.organization.getOrganizations({
      projectKey: "pk",
      page: 1,
      pageSize: 20,
    });
    expect(http.get).toHaveBeenCalledWith(
      `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATIONS}?projectKey=pk&page=1&pageSize=20`,
      undefined,
      ABS,
    );
  });
});
