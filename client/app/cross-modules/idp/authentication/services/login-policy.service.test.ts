import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { API_BASES } from "@/constants/endpoint.constant";
import { LoginPolicyService } from "./login-policy.service";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ENDPOINT = `${API_BASES.IAM}/iam/login-policy`;
const POLICY = { allowEmbedded: true, allowOidc: false, allowPassword: true, allowSocial: true };

describe("LoginPolicyService", () => {
  let service: LoginPolicyService;

  beforeEach(() => {
    service = new LoginPolicyService();
    vi.clearAllMocks();
  });

  it("GETs the tenant policy from the IAM endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue({ isSuccess: true, loginPolicy: POLICY });

    const result = await service.getTenantPolicy();

    expect(http.get).toHaveBeenCalledWith(ENDPOINT, undefined, { absoluteUrl: true });
    expect(result.loginPolicy).toEqual(POLICY);
  });

  it("POSTs the policy to the IAM endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });

    const result = await service.saveTenantPolicy(POLICY);

    expect(http.post).toHaveBeenCalledWith(ENDPOINT, POLICY, undefined, { absoluteUrl: true });
    expect(result.isSuccess).toBe(true);
  });
});
