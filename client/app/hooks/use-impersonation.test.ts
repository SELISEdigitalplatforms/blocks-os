import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { impersonationService } from "@/services/impersonation.service";
import {
  useStartImpersonation,
  useStopImpersonation,
  useImpersonationStatusChecker,
} from "./use-impersonation";

vi.mock("@/services/impersonation.service", () => ({
  impersonationService: {
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    impersonationStatus: vi.fn(),
  },
}));

describe("use-impersonation hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useStartImpersonation calls startImpersonation with the payload", async () => {
    vi.mocked(impersonationService.startImpersonation).mockResolvedValue({
      rootTenantId: "root",
    } as never);

    const { result } = renderHook(() => useStartImpersonation(), {
      wrapper: createWrapper(),
    });

    const payload = { targeted_tenant_id: "t-1" };
    await result.current.mutateAsync(payload);

    // react-query also passes a mutation context as a second arg, so assert on
    // the first argument only.
    expect(impersonationService.startImpersonation).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(impersonationService.startImpersonation).mock.calls[0][0],
    ).toEqual(payload);
  });

  it("useStopImpersonation calls stopImpersonation", async () => {
    vi.mocked(impersonationService.stopImpersonation).mockResolvedValue(
      undefined as never,
    );

    const { result } = renderHook(() => useStopImpersonation(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync(undefined as never);

    expect(impersonationService.stopImpersonation).toHaveBeenCalledTimes(1);
  });

  it("useImpersonationStatusChecker fetches the impersonation status", async () => {
    vi.mocked(impersonationService.impersonationStatus).mockResolvedValue({
      impersonated: false,
      originalTenantId: "orig",
      impersonatedTenantId: null,
    });

    const { result } = renderHook(() => useImpersonationStatusChecker(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(impersonationService.impersonationStatus).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({
      impersonated: false,
      originalTenantId: "orig",
      impersonatedTenantId: null,
    });
  });

  it("useStartImpersonation surfaces service errors", async () => {
    vi.mocked(impersonationService.startImpersonation).mockRejectedValue(
      new Error("boom"),
    );

    const { result } = renderHook(() => useStartImpersonation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({ targeted_tenant_id: "t-1" }),
    ).rejects.toThrow("boom");
  });
});
