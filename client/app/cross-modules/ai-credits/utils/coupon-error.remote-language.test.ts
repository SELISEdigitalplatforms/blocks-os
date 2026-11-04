import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { getCouponErrorMessage } from "./coupon-error";

describe("AI credits coupon errors in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows remote text once a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.ai-credits", {
      "COUPON_ERROR.THIS_VOUCHER_HAS_EXPIRED": "[xx] COUPON_ERROR.THIS_VOUCHER_HAS_EXPIRED",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });
    expect(getCouponErrorMessage({ errors: { detail: { code: "coupon_expired" } } })).toBe(
      "[xx] COUPON_ERROR.THIS_VOUCHER_HAS_EXPIRED",
    );
  });
});
