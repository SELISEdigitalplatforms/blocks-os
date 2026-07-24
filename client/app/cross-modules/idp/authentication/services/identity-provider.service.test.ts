import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { IdentityProviderService } from "./identity-provider.service";
import { IDENTITY_PROVIDER_ENDPOINTS } from "@blocks-idp/authentication/constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("IdentityProviderService", () => {
  let service: IdentityProviderService;

  beforeEach(() => {
    service = new IdentityProviderService();
    vi.clearAllMocks();
  });

  afterEach(() => vi.clearAllMocks());

  it("getAll GETs the identity providers endpoint with absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [] } as never);
    await service.getAll();
    expect(http.get).toHaveBeenCalledWith(
      IDENTITY_PROVIDER_ENDPOINTS.GET_ALL,
      undefined,
      ABS,
    );
  });

  it("getById appends the id to the path", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: {} } as never);
    await service.getById("idp-1");
    expect(http.get).toHaveBeenCalledWith(
      `${IDENTITY_PROVIDER_ENDPOINTS.GET_BY_ID}/idp-1`,
      undefined,
      ABS,
    );
  });

  it("create POSTs the provider forcing the oidc protocol", async () => {
    vi.mocked(http.post).mockResolvedValue({ data: {} } as never);
    const provider = { name: "My IdP" } as never;
    await service.create(provider);
    expect(http.post).toHaveBeenCalledWith(
      IDENTITY_PROVIDER_ENDPOINTS.CREATE,
      { name: "My IdP", protocol: "oidc" },
      undefined,
      ABS,
    );
  });

  it("update PUTs to the id path forcing the oidc protocol", async () => {
    vi.mocked(http.put).mockResolvedValue({ data: {} } as never);
    const provider = { name: "Renamed" } as never;
    await service.update("idp-2", provider);
    expect(http.put).toHaveBeenCalledWith(
      `${IDENTITY_PROVIDER_ENDPOINTS.UPDATE}/idp-2`,
      { name: "Renamed", protocol: "oidc" },
      undefined,
      ABS,
    );
  });

  it("updateStatus PATCHes the status sub-path", async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: {} } as never);
    const request = { isEnabled: true } as never;
    await service.updateStatus("idp-3", request);
    expect(http.patch).toHaveBeenCalledWith(
      `${IDENTITY_PROVIDER_ENDPOINTS.UPDATE_STATUS}/idp-3/status`,
      request,
      undefined,
      ABS,
    );
  });

  it("delete DELETEs the id path", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true } as never);
    await service.delete("idp-4");
    expect(http.delete).toHaveBeenCalledWith(
      `${IDENTITY_PROVIDER_ENDPOINTS.DELETE}/idp-4`,
      undefined,
      ABS,
    );
  });

  it("propagates errors from the http layer", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("boom"));
    await expect(service.getAll()).rejects.toThrow("boom");
  });
});
