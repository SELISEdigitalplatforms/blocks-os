import { describe, expect, it } from "vitest";
import { refusal } from "../test-utils/__mocks__";
import { getCouponErrorMessage, getRefusalCode } from "./coupon-error";

describe("voucher errors", () => {
  it("reads the stable code from the wrapped FastAPI body", () => {
    expect(getRefusalCode(refusal(404, "coupon_not_found"))).toBe("coupon_not_found");
  });

  it.each([
    ["coupon_not_found", "We could not find this voucher. Check the code and try again."],
    ["coupon_expired", "This voucher has expired."],
    ["coupon_already_used", "This project has already used this voucher."],
    ["coupon_in_use", "This voucher is already being redeemed. Try again in a few minutes."],
    [
      "coupon_lowers_price",
      "This voucher gives a discount on a top-up. It does not add credits here.",
    ],
  ])("maps %s to its message", (code, message) => {
    expect(getCouponErrorMessage(refusal(409, code))).toBe(message);
  });

  it("explains a plain-text 403 as missing permission", () => {
    const error = Object.assign(new Error("x"), { status: 403, errors: { detail: "Forbidden" } });
    expect(getCouponErrorMessage(error)).toBe(
      "You do not have permission to redeem vouchers in this project.",
    );
  });

  it("falls back to a generic message for unknown codes and odd errors", () => {
    expect(getCouponErrorMessage(refusal(400, "something_new"))).toBe(
      "Something went wrong. Try again.",
    );
    expect(getCouponErrorMessage(null)).toBe("Something went wrong. Try again.");
  });
});
