import { describe, expect, it } from "vitest";
import { maskId } from "./mask-id.util";

describe("maskId", () => {
  it("keeps the first and last 4 characters of a long id", () => {
    expect(maskId("abcd-1234-5678-wxyz")).toBe("abcd********wxyz");
  });

  it("shows only the first 2 characters of a short id", () => {
    expect(maskId("cc-new")).toBe("cc********");
  });

  it("returns an empty string for a missing id", () => {
    expect(maskId(undefined)).toBe("");
    expect(maskId("")).toBe("");
  });
});
