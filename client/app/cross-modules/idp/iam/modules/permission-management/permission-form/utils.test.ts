import { describe, expect, it } from "vitest";
import { getBuiltinPermissionReadonlyMessage, isPermissionFormReadOnly } from "./utils";

describe("isPermissionFormReadOnly", () => {
  it("returns true when permission is built-in", () => {
    expect(isPermissionFormReadOnly(true)).toBe(true);
  });

  it("returns false when permission is custom", () => {
    expect(isPermissionFormReadOnly(false)).toBe(false);
  });
});

describe("getBuiltinPermissionReadonlyMessage", () => {
  it("explains built-in permissions cannot be modified", () => {
    expect(getBuiltinPermissionReadonlyMessage()).toContain("Built-in");
    expect(getBuiltinPermissionReadonlyMessage()).toContain("cannot be modified");
  });
});
