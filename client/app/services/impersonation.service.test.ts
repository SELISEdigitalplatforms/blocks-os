import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { impersonationService } from "./impersonation.service";
import { IMPERSONATE_ENDPOINTS } from "@/idp/authentication/constants";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("impersonationService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("startImpersonation POSTs the request to the impersonate endpoint", async () => {
    const state = { rootTenantId: "root" };
    vi.mocked(http.post).mockResolvedValue(state);

    const request = { targeted_tenant_id: "t-1" };
    const result = await impersonationService.startImpersonation(request);

    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATE_ENDPOINTS.IMPERSONATE,
      request,
      undefined,
      ABS,
    );
    expect(result).toBe(state);
  });

  it("stopImpersonation POSTs an empty body", async () => {
    vi.mocked(http.post).mockResolvedValue(undefined);

    await impersonationService.stopImpersonation();

    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATE_ENDPOINTS.STOP_IMPERSONATION,
      {},
      undefined,
      ABS,
    );
  });

  it("impersonationStatus POSTs a null body to the status endpoint", async () => {
    const status = {
      impersonated: true,
      originalTenantId: "orig",
      impersonatedTenantId: "imp",
    };
    vi.mocked(http.post).mockResolvedValue(status);

    const result = await impersonationService.impersonationStatus();

    expect(http.post).toHaveBeenCalledWith(
      IMPERSONATE_ENDPOINTS.IMPERSONATION_STATUS,
      null,
      undefined,
      ABS,
    );
    expect(result).toBe(status);
  });

  it("propagates errors from the http layer", async () => {
    vi.mocked(http.post).mockRejectedValue(new Error("boom"));
    await expect(
      impersonationService.startImpersonation({ targeted_tenant_id: "t-1" }),
    ).rejects.toThrow("boom");
  });
});
