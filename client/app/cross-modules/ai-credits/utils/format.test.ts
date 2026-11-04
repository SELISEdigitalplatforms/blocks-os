import { describe, expect, it } from "vitest";
import { describeLastTopUp, formatCouponCode, formatCredits, percentOf } from "./format";

describe("format", () => {
  it("formats credits with grouping and at most 2 decimals", () => {
    expect(formatCredits(6347.5)).toBe("6,347.5");
    expect(formatCredits(12.345678)).toBe("12.35");
  });

  it("clamps percentages and handles an empty pool", () => {
    expect(percentOf(60, 100)).toBe(60);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(150, 100)).toBe(100);
  });

  it("prints a coupon code with the dash", () => {
    expect(formatCouponCode("ZJWLGQ7Y")).toBe("ZJWL-GQ7Y");
    expect(formatCouponCode("ZJW")).toBe("ZJW");
  });

  it("describes the last top-up", () => {
    expect(describeLastTopUp(null)).toBe("None yet");
    expect(
      describeLastTopUp({
        topUpId: "t",
        state: "Paid",
        creditsGranted: 2500,
        failureReason: null,
        createdDate: "2026-10-11T10:00:00Z",
      }),
    ).toBe("11 Oct 2026 · 2,500 credits");
    expect(
      describeLastTopUp({
        topUpId: "t",
        state: "Expired",
        creditsGranted: null,
        failureReason: null,
        createdDate: null,
      }),
    ).toBe("Expired");
  });
});
