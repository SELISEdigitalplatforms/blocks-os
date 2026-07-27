import { describe, expect, it } from "vitest";
import { isAlreadyActivatedSignal } from "./utils";

describe("isAlreadyActivatedSignal", () => {
  it("returns false for null/undefined", () => {
    expect(isAlreadyActivatedSignal(null)).toBe(false);
    expect(isAlreadyActivatedSignal(undefined)).toBe(false);
  });

  it("returns false for an unrelated invalid-code error", () => {
    expect(
      isAlreadyActivatedSignal({ Invalid_ActivationCode: "The activation code is invalid" }),
    ).toBe(false);
    expect(isAlreadyActivatedSignal("Invalid activation code")).toBe(false);
  });

  it("detects an already-activated error key", () => {
    expect(isAlreadyActivatedSignal({ already_activated: "x" })).toBe(true);
    expect(isAlreadyActivatedSignal({ already_signup: "x" })).toBe(true);
    expect(isAlreadyActivatedSignal({ AlreadyActive: "x" })).toBe(true);
  });

  it("detects an already-activated message value", () => {
    expect(isAlreadyActivatedSignal({ code: "This account is already activated" })).toBe(true);
    expect(isAlreadyActivatedSignal("Account already signed up")).toBe(true);
  });
});
