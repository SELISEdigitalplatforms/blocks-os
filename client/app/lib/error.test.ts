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

describe("getErrorMessage value-first lookup", () => {
  // Server errors that carry a reason code put it in the VALUE and reuse a small set of category
  // keys, so a key-only lookup cannot tell those reasons apart.
  const map = {
    Role_Has_Child_Roles: "Archive the child roles first.",
    forbidden: "Not allowed.",
  };

  it("prefers the value when both the value and the key are mapped", () => {
    expect(getErrorMessage({ forbidden: "Role_Has_Child_Roles" }, map)).toEqual([
      "Archive the child roles first.",
    ]);
  });

  it("distinguishes two reasons that share one category key", () => {
    // This is the whole point: key-first would return the same message for both.
    const codes = {
      Role_Has_Child_Roles: "Archive the child roles first.",
      Can_Not_Archive_Default_Copied_Role: "Copied from the default organization.",
    };
    expect(getErrorMessage({ forbidden: "Role_Has_Child_Roles" }, codes)).toEqual([
      "Archive the child roles first.",
    ]);
    expect(getErrorMessage({ forbidden: "Can_Not_Archive_Default_Copied_Role" }, codes)).toEqual([
      "Copied from the default organization.",
    ]);
  });

  it("still falls back to the key so existing callers keep working", () => {
    expect(getErrorMessage({ forbidden: "Some_Unmapped_Code" }, map)).toEqual(["Not allowed."]);
  });

  it("falls back to the raw value when neither is mapped", () => {
    expect(getErrorMessage({ dependency: "Some_New_Backend_Code" }, map)).toEqual([
      "Some_New_Backend_Code",
    ]);
  });

  it("skips blank values rather than rendering an empty message", () => {
    // { dependency: "" } used to produce a single blank line in the toast.
    expect(getErrorMessage({ dependency: "" }, { Some_Code: "mapped" })).toBe("Something went wrong.");
    expect(getErrorMessage({ a: "   ", b: "real" })).toEqual(["real"]);
  });

  it("maps each element of an array value", () => {
    // Joining first meant a string[] of reason codes never hit the map.
    expect(getErrorMessage({ dependency: ["A_Code", "B_Code"] }, { A_Code: "first", B_Code: "second" })).toEqual([
      "first, second",
    ]);
  });

  it("still joins array values when nothing maps, as before", () => {
    expect(getErrorMessage({ dependency: ["one", "two"] })).toEqual(["one, two"]);
  });

  it("drops blank array elements", () => {
    expect(getErrorMessage({ dependency: ["", "  ", "real"] })).toEqual(["real"]);
    expect(getErrorMessage({ dependency: ["", "  "] })).toBe("Something went wrong.");
  });
});
