import { describe, expect, it } from "vitest";
import { QUOTA_REDIRECT_CONFIG } from "./quota-redirect-config";

describe("QUOTA_REDIRECT_CONFIG", () => {
  it("maps known quota keys to their redirect paths", () => {
    expect(QUOTA_REDIRECT_CONFIG.PEOPLE).toBe("/people");
    expect(QUOTA_REDIRECT_CONFIG.IAM).toBe("/services/iam");
  });

  it("returns undefined for an unknown key", () => {
    expect(QUOTA_REDIRECT_CONFIG.UNKNOWN).toBeUndefined();
  });
});
