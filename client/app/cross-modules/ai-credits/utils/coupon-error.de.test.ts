import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { getCouponErrorMessage } from "./coupon-error";

describe("AI credits coupon errors in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows German text once a German dictionary is registered", () => {
    useI18nStore
      .getState()
      .setRemote("de", "os.ai-credits", {
        "COUPON_ERROR.THIS_VOUCHER_HAS_EXPIRED": "Dieser Gutschein ist abgelaufen.",
      });
    useAppSettingsStore.getState().setSettings({ language: "de" });
    expect(getCouponErrorMessage({ errors: { detail: { code: "coupon_expired" } } })).toBe(
      "Dieser Gutschein ist abgelaufen.",
    );
  });
});
