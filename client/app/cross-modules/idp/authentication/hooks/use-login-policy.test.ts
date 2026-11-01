import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { loginPolicyService } from "@blocks-idp/authentication/services/login-policy.service";
import { useGetTenantLoginPolicy, useSaveTenantLoginPolicy } from "./use-login-policy";

const h = vi.hoisted(() => ({ tenantId: "tenant-1" as string | undefined }));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: h.tenantId ? { tenantId: h.tenantId } : undefined }),
}));
vi.mock("@blocks-idp/authentication/services/login-policy.service", () => ({
  loginPolicyService: { getTenantPolicy: vi.fn(), saveTenantPolicy: vi.fn() },
}));

const POLICY = { allowEmbedded: true, allowOidc: true, allowPassword: false, allowSocial: true };

describe("use-login-policy hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.tenantId = "tenant-1";
  });

  it("loads the tenant policy when a project is selected", async () => {
    vi.mocked(loginPolicyService.getTenantPolicy).mockResolvedValue({ isSuccess: true, loginPolicy: POLICY });

    const { result } = renderHook(() => useGetTenantLoginPolicy(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.loginPolicy).toEqual(POLICY);
  });

  it("does not load without a selected project", () => {
    h.tenantId = undefined;

    const { result } = renderHook(() => useGetTenantLoginPolicy(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("idle");
    expect(loginPolicyService.getTenantPolicy).not.toHaveBeenCalled();
  });

  it("does not load when disabled", () => {
    renderHook(() => useGetTenantLoginPolicy(false), { wrapper: createWrapper() });

    expect(loginPolicyService.getTenantPolicy).not.toHaveBeenCalled();
  });

  it("saves the policy", async () => {
    vi.mocked(loginPolicyService.saveTenantPolicy).mockResolvedValue({ isSuccess: true });

    const { result } = renderHook(() => useSaveTenantLoginPolicy(), { wrapper: createWrapper() });
    result.current.mutate(POLICY);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(loginPolicyService.saveTenantPolicy).toHaveBeenCalledWith(POLICY);
  });
});
