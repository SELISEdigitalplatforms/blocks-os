import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { GRANT_ENDPOINTS } from "../constants/endpoint.constant";
import { grantScopeService } from "./grant-scope.service";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("grantScopeService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the grant scope from IAM with an absolute url", async () => {
    const scope = {
      isSystemUser: false,
      heldRoles: ["a"],
      managedRoles: ["b"],
      assignableRoles: ["b"],
      heldPermissions: ["p"],
    };
    vi.mocked(http.get).mockResolvedValue(scope as never);

    await expect(grantScopeService.getScope()).resolves.toEqual(scope);
    expect(GRANT_ENDPOINTS.SCOPE).toMatch(/\/iam\/grant-scope$/);
    expect(http.get).toHaveBeenCalledWith(GRANT_ENDPOINTS.SCOPE, undefined, {
      absoluteUrl: true,
    });
  });
});
