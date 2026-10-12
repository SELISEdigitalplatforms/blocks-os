import { describe, expect, it } from "vitest";
import { refusal } from "../test-utils/__mocks__";
import { getCouponErrorMessage, getRefusalCode, NOT_FULLY_COVERED_MESSAGE } from "./coupon-error";

describe("coupon errors", () => {
  it("reads the stable code from the wrapped FastAPI body", () => {
    expect(getRefusalCode(refusal(404, "coupon_not_found"))).toBe("coupon_not_found");
  });

  it.each([
    ["coupon_not_found", "We could not find this coupon. Check the code and try again."],
    ["coupon_expired", "This coupon has expired."],
    ["coupon_already_used", "This project has already used this coupon."],
    ["coupon_in_use", "This coupon is already being redeemed. Try again in a few minutes."],
    ["billing_profile_incomplete", NOT_FULLY_COVERED_MESSAGE],
    ["payable_below_minimum", NOT_FULLY_COVERED_MESSAGE],
  ])("maps %s to its message", (code, message) => {
    expect(getCouponErrorMessage(refusal(409, code))).toBe(message);
  });

  it("explains a plain-text 403 as missing permission", () => {
    const error = Object.assign(new Error("x"), { status: 403, errors: { detail: "Forbidden" } });
    expect(getCouponErrorMessage(error)).toBe(
      "You do not have permission to redeem coupons in this project.",
    );
  });

  it("falls back to a generic message for unknown codes and odd errors", () => {
    expect(getCouponErrorMessage(refusal(400, "something_new"))).toBe(
      "Something went wrong. Try again.",
    );
    expect(getCouponErrorMessage(null)).toBe("Something went wrong. Try again.");
  });
});
