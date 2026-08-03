import { describe, expect, it } from "vitest";
import { BUILTIN_PERMISSION_READONLY_MESSAGE, isPermissionFormReadOnly } from "./utils";

describe("isPermissionFormReadOnly", () => {
  it("returns true when permission is built-in", () => {
    expect(isPermissionFormReadOnly(true)).toBe(true);
  });

  it("returns false when permission is custom", () => {
    expect(isPermissionFormReadOnly(false)).toBe(false);
  });
});

describe("BUILTIN_PERMISSION_READONLY_MESSAGE", () => {
  it("explains built-in permissions cannot be modified", () => {
    expect(BUILTIN_PERMISSION_READONLY_MESSAGE).toContain("Built-in");
    expect(BUILTIN_PERMISSION_READONLY_MESSAGE).toContain("cannot be modified");
  });
});
