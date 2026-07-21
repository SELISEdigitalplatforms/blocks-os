import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { authenticationService } from "./authentication.service";
import { AuthConfiguration } from "./auth-config.service";
import { AUTH_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };

describe("authenticationService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("exposes an AuthConfiguration instance", () => {
    expect(authenticationService.configuration).toBeInstanceOf(AuthConfiguration);
  });

  it("configuration.getConfig delegates to http.get with absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await authenticationService.configuration.getConfig();
    expect(http.get).toHaveBeenCalledWith(
      AUTH_CONFIG_ENDPOINTS.GET_CONFIG,
      undefined,
      ABS,
    );
  });

  it("configuration.getConfig appends the project key when provided", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await authenticationService.configuration.getConfig({ projectKey: "pk" });
    expect(http.get).toHaveBeenCalledWith(
      `${AUTH_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=pk`,
      undefined,
      ABS,
    );
  });

  it("configuration.saveAuthConfig posts to the update endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { requireEmailVerification: true } as never;
    await authenticationService.configuration.saveAuthConfig(payload);
    expect(http.post).toHaveBeenCalledWith(
      AUTH_CONFIG_ENDPOINTS.UPDATE_CONFIG,
      payload,
      undefined,
      ABS,
    );
  });
});
