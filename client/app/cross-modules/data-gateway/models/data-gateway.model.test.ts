import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION_NAME_PATTERN } from "./data-gateway.model";

describe("DEFAULT_COLLECTION_NAME_PATTERN", () => {
  it("matches the backend's documented default pattern", () => {
    expect(DEFAULT_COLLECTION_NAME_PATTERN).toBe("sb_{SchemaName}s");
  });
});
