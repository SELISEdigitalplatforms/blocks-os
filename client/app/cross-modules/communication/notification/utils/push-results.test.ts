import { describe, expect, it } from "vitest";
import { isApnsFailure, keyedDevices, resultFix, resultLabel } from "./push-results";

describe("result codes", () => {
  it("gives every failure a label, and every failure but delivered a fix line", () => {
    for (const code of [
      "apnsKeyMissing",
      "apnsKeyRejected",
      "wrongApp",
      "tokenExpired",
      "keyRefused",
      "failed",
    ]) {
      expect(resultLabel(code)).not.toBe("");
      expect(resultFix(code)).toBeTruthy();
    }
    expect(resultFix("delivered")).toBeNull();
  });

  it("reads an unknown code as a plain failure", () => {
    expect(resultLabel("somethingNew")).toBe("Failed");
  });

  it("shows the Apple key hint only for iOS APNs failures", () => {
    expect(isApnsFailure("ios", "apnsKeyMissing")).toBe(true);
    expect(isApnsFailure("android", "apnsKeyMissing")).toBe(false);
    expect(isApnsFailure("ios", "tokenExpired")).toBe(false);
  });
});

describe("keyedDevices", () => {
  it("keeps keys unique when two devices read the same", () => {
    const rows = keyedDevices([
      { platform: "android", name: "Pixel" },
      { platform: "android", name: "Pixel" },
    ]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  });
});
