import { describe, expect, it } from "vitest";
import { ResourceType } from "./role";

describe("ResourceType (legacy role model enum)", () => {
  it("maps resource kinds to their numeric codes", () => {
    expect(ResourceType.Endpoint).toBe(1);
    expect(ResourceType["FE action"]).toBe(2);
    expect(ResourceType["Data protection"]).toBe(3);
  });

  it("supports reverse lookup by numeric value", () => {
    expect(ResourceType[1]).toBe("Endpoint");
    expect(ResourceType[3]).toBe("Data protection");
  });
});
