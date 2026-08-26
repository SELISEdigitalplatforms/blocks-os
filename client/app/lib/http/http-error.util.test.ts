import { describe, expect, it } from "vitest";
import { getHttpErrorStatus, isHttpErrorStatus } from "./http-error.util";

describe("getHttpErrorStatus", () => {
  it("reads the status off a rejected request", () => {
    expect(getHttpErrorStatus(Object.assign(new Error("nope"), { status: 403 }))).toBe(403);
  });

  it("reads the status off a plain object", () => {
    expect(getHttpErrorStatus({ status: 500, errors: {} })).toBe(500);
  });

  it("returns undefined for a transport failure, which carries no status", () => {
    expect(getHttpErrorStatus(new TypeError("Failed to fetch"))).toBeUndefined();
  });

  it("ignores a non-numeric status", () => {
    expect(getHttpErrorStatus({ status: "500" })).toBeUndefined();
  });

  it.each([null, undefined, "boom", 404])("returns undefined for %p", (value) => {
    expect(getHttpErrorStatus(value)).toBeUndefined();
  });
});

describe("isHttpErrorStatus", () => {
  it("matches the given status", () => {
    expect(isHttpErrorStatus({ status: 404 }, 404)).toBe(true);
  });

  it("does not match a different status", () => {
    expect(isHttpErrorStatus({ status: 404 }, 403)).toBe(false);
  });
});
