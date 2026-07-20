import { describe, expect, it } from "vitest";
import { parseResourceType, formatResourceName } from "./parse-resource";

describe("parseResourceType", () => {
  it("returns an empty string for empty input", () => {
    expect(parseResourceType("")).toBe("");
  });

  it("extracts and uppercases the middle segment", () => {
    expect(parseResourceType("blocks-identifier-api::people::invite")).toBe("PEOPLE");
  });

  it("uppercases the whole value when there is no '::' delimiter", () => {
    expect(parseResourceType("people")).toBe("PEOPLE");
  });
});

describe("formatResourceName", () => {
  it("capitalizes only the first letter of the resource type", () => {
    expect(formatResourceName("blocks-identifier-api::people::invite")).toBe("People");
  });

  it("returns 'Unknown' when the resource type is empty", () => {
    expect(formatResourceName("")).toBe("Unknown");
  });
});
