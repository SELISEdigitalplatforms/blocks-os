import { describe, expect, it } from "vitest";
import { getTrimmedSearchParam, getOptionalSearchParam } from "./search-params";

describe("search-params", () => {
  const params = new URLSearchParams("a=%20hello%20&b=&c=world");

  describe("getTrimmedSearchParam", () => {
    it("trims a present value", () => {
      expect(getTrimmedSearchParam(params, "a")).toBe("hello");
    });
    it("returns an empty string for a blank value", () => {
      expect(getTrimmedSearchParam(params, "b")).toBe("");
    });
    it("returns an empty string for a missing key", () => {
      expect(getTrimmedSearchParam(params, "missing")).toBe("");
    });
  });

  describe("getOptionalSearchParam", () => {
    it("returns the trimmed value when present", () => {
      expect(getOptionalSearchParam(params, "c")).toBe("world");
    });
    it("returns undefined for a blank value", () => {
      expect(getOptionalSearchParam(params, "b")).toBeUndefined();
    });
    it("returns undefined for a missing key", () => {
      expect(getOptionalSearchParam(params, "missing")).toBeUndefined();
    });
  });
});
