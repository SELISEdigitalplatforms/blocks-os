import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { AiCreditsService } from "./ai-credits.service";
import { mockRedeemedCoupon, mockUsage } from "../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => "https://agents.test" }));

const ABS = { absoluteUrl: true };

describe("AiCreditsService", () => {
  let service: AiCreditsService;

  beforeEach(() => {
    service = new AiCreditsService();
    vi.clearAllMocks();
  });

  it("getUsage reads the current usage from blocks-agents with no project key", async () => {
    vi.mocked(http.get).mockResolvedValue(mockUsage);

    const result = await service.getUsage();

    expect(http.get).toHaveBeenCalledWith(
      "https://agents.test/api/agent-credits/usage/current",
      undefined,
      ABS,
    );
    expect(result).toEqual(mockUsage);
  });

  it("redeemCoupon posts the code to the coupon redeem route", async () => {
    vi.mocked(http.post).mockResolvedValue(mockRedeemedCoupon);
    const payload = { couponCode: "ZJWLGQ7Y" };

    const result = await service.redeemCoupon(payload);

    expect(http.post).toHaveBeenCalledWith(
      "https://agents.test/api/agent-credits/coupons/redeem",
      payload,
      undefined,
      ABS,
    );
    expect(result).toEqual(mockRedeemedCoupon);
  });
});
