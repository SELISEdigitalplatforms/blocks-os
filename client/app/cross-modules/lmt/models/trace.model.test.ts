import { describe, expect, it } from "vitest";
import { getTypeColor } from "./trace.model";

describe("getTypeColor", () => {
  it("maps GET to success", () => {
    expect(getTypeColor("GET")).toBe("text-success");
  });
  it("maps POST to warning", () => {
    expect(getTypeColor("POST")).toBe("text-icon-warning");
  });
  it("falls back to error for other methods", () => {
    expect(getTypeColor("DELETE")).toBe("text-error");
    expect(getTypeColor("")).toBe("text-error");
  });
});
