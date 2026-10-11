import { describe, expect, it } from "vitest";
import {
  existingUserPasswordLabel,
  fromConfigurationMaxRedemptions,
  MAX_REDEMPTIONS_LIMIT,
  maxRedemptionsLabel,
  toCreateMaxRedemptions,
  toEditMaxRedemptions,
} from "./max-redemptions";

describe("max-redemptions mapping (#645)", () => {
  it("uses the Int32 limit", () => {
    expect(MAX_REDEMPTIONS_LIMIT).toBe(2147483647);
  });

  it("create: empty sends null, digits send the number (H7, H8, C3)", () => {
    expect(toCreateMaxRedemptions("")).toBeNull();
    expect(toCreateMaxRedemptions("   ")).toBeNull();
    expect(toCreateMaxRedemptions(undefined)).toBeNull();
    expect(toCreateMaxRedemptions(null)).toBeNull();
    expect(toCreateMaxRedemptions("0")).toBe(0);
    expect(toCreateMaxRedemptions("12")).toBe(12);
  });

  it("edit save: empty sends 1, digits send the number (H8, H10)", () => {
    expect(toEditMaxRedemptions("")).toBe(1);
    expect(toEditMaxRedemptions(undefined)).toBe(1);
    expect(toEditMaxRedemptions("0")).toBe(0);
    expect(toEditMaxRedemptions("5")).toBe(5);
  });

  it("edit load: null shows empty, a number shows its digits (H9)", () => {
    expect(fromConfigurationMaxRedemptions(null)).toBe("");
    expect(fromConfigurationMaxRedemptions(undefined)).toBe("");
    expect(fromConfigurationMaxRedemptions(0)).toBe("0");
    expect(fromConfigurationMaxRedemptions(5)).toBe("5");
  });

  it("labels the Max uses cell (H11)", () => {
    expect(maxRedemptionsLabel(null)).toBe("Single use");
    expect(maxRedemptionsLabel(undefined)).toBe("Single use");
    expect(maxRedemptionsLabel(1)).toBe("Single use");
    expect(maxRedemptionsLabel(0)).toBe("Unlimited");
    expect(maxRedemptionsLabel(5)).toBe("5 uses");
  });

  it("labels the Existing-user password cell (H12, C10)", () => {
    expect(existingUserPasswordLabel(true)).toBe("Required");
    expect(existingUserPasswordLabel(undefined)).toBe("Required");
    expect(existingUserPasswordLabel(null)).toBe("Required");
    expect(existingUserPasswordLabel(false)).toBe("Not required");
  });
});
