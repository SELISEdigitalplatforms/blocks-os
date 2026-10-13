import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { aiCreditsService } from "../services/ai-credits.service";
import { mockPaidTopUp, mockUsage } from "../test-utils/__mocks__";
import { useGetAiCreditsUsage, useRedeemCoupon } from "./use-ai-credits";

vi.mock("../services/ai-credits.service", () => ({
  aiCreditsService: { getUsage: vi.fn(), createTopUp: vi.fn() },
}));

describe("AI credits hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useGetAiCreditsUsage returns the usage", async () => {
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue(mockUsage);

    const { result } = renderHook(() => useGetAiCreditsUsage(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUsage);
  });

  it("useRedeemCoupon posts the top-up and re-reads the usage", async () => {
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue(mockUsage);
    vi.mocked(aiCreditsService.createTopUp).mockResolvedValue(mockPaidTopUp);
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ usage: useGetAiCreditsUsage(), redeem: useRedeemCoupon() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.usage.isSuccess).toBe(true));
    expect(aiCreditsService.getUsage).toHaveBeenCalledTimes(1);

    const payload = { amountChf: 25, requestId: "req-12345678", couponCode: "ZJWLGQ7Y" };
    await result.current.redeem.mutateAsync(payload);

    expect(aiCreditsService.createTopUp).toHaveBeenCalledWith(payload);
    await waitFor(() => expect(aiCreditsService.getUsage).toHaveBeenCalledTimes(2));
  });
});
