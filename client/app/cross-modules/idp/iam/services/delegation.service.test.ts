import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { DELEGATION_ENDPOINTS } from "../constants/endpoint.constant";
import { delegationService } from "./delegation.service";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("delegationService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the delegation scope from IAM with an absolute url", async () => {
    const scope = {
      isSystemUser: false,
      mode: "Enforce",
      heldRoles: ["a"],
      managedRoles: ["b"],
      assignableRoles: ["b"],
      heldPermissions: ["p"],
    };
    vi.mocked(http.get).mockResolvedValue(scope as never);

    await expect(delegationService.getScope()).resolves.toEqual(scope);
    expect(DELEGATION_ENDPOINTS.SCOPE).toMatch(/\/iam\/delegation-scope$/);
    expect(http.get).toHaveBeenCalledWith(DELEGATION_ENDPOINTS.SCOPE, undefined, {
      absoluteUrl: true,
    });
  });
});
