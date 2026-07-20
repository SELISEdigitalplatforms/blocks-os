import { describe, expect, it } from "vitest";
import { status } from "./user";

describe("user status options", () => {
  it("exposes the account status choices", () => {
    expect(status.map((s) => s.value)).toEqual([
      "Active",
      "Inactive",
      "Verified",
    ]);
  });

  it("uses the value as the display label", () => {
    status.forEach((s) => expect(s.label).toBe(s.value));
  });
});
