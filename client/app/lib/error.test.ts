import { describe, expect, it } from "vitest";
import { isErrorWithErrors, hasErrorCode, getErrorMessage, handleErrorMessages } from "./error";

describe("lib/error", () => {
  describe("isErrorWithErrors", () => {
    it("returns true for an object with a non-null errors object", () => {
      expect(isErrorWithErrors({ errors: { code: "x" } })).toBe(true);
    });
    it("returns false for null", () => {
      expect(isErrorWithErrors(null)).toBe(false);
    });
    it("returns false when errors is not an object", () => {
      expect(isErrorWithErrors({ errors: "oops" })).toBe(false);
    });
    it("returns false when there is no errors key", () => {
      expect(isErrorWithErrors({ message: "hi" })).toBe(false);
    });
  });

  describe("hasErrorCode", () => {
    it("returns true when a string code has content", () => {
      expect(hasErrorCode({ EMAIL_TAKEN: "taken" }, "EMAIL_TAKEN")).toBe(true);
    });
    it("returns false when the string code is empty", () => {
      expect(hasErrorCode({ EMAIL_TAKEN: "" }, "EMAIL_TAKEN")).toBe(false);
    });
    it("returns true when an array code is non-empty", () => {
      expect(hasErrorCode({ EMAIL_TAKEN: ["a"] }, "EMAIL_TAKEN")).toBe(true);
    });
    it("returns false when the array code is empty", () => {
      expect(hasErrorCode({ EMAIL_TAKEN: [] }, "EMAIL_TAKEN")).toBe(false);
    });
    it("returns false when the code is absent", () => {
      expect(hasErrorCode({}, "MISSING")).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("returns a fallback for an empty error object", () => {
      expect(getErrorMessage({})).toBe("Something went wrong.");
    });
    it("prefers a mapped message when provided", () => {
      expect(
        getErrorMessage({ EMAIL_TAKEN: "raw" }, { EMAIL_TAKEN: "Email already used" }),
      ).toEqual(["Email already used"]);
    });
    it("collects string and array values", () => {
      expect(getErrorMessage({ a: "first", b: ["second", "third"] })).toEqual([
        "first",
        "second, third",
      ]);
    });
    it("falls back when no usable values are found", () => {
      expect(getErrorMessage({ a: [] })).toBe("Something went wrong.");
    });
  });

  describe("handleErrorMessages", () => {
    it("returns a plain string error as-is", () => {
      expect(handleErrorMessages("boom")).toBe("boom");
    });
    it("delegates to getErrorMessage for error objects", () => {
      expect(handleErrorMessages({ a: "bad" })).toEqual(["bad"]);
    });
    it("returns a generic message for arrays and other types", () => {
      expect(handleErrorMessages([1, 2, 3])).toBe("An unexpected error occurred.");
      expect(handleErrorMessages(42)).toBe("An unexpected error occurred.");
    });
  });
});
