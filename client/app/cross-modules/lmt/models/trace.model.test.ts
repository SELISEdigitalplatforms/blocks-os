import { describe, expect, it } from "vitest";
import { getTraceStatus, getTypeColor } from "./trace.model";

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

describe("getTraceStatus", () => {
  it("prefers the HTTP response code the status-code filter queries", () => {
    expect(getTraceStatus({ attributes: { "response.status.code": 500 }, status: "Ok" })).toEqual({
      label: "500",
      variant: "error",
    });
  });

  it("falls back to the OpenTelemetry attribute name", () => {
    expect(getTraceStatus({ attributes: { "http.response.status_code": 404 } })).toEqual({
      label: "404",
      variant: "warning",
    });
  });

  it("accepts a code stored as a string", () => {
    expect(getTraceStatus({ attributes: { "response.status.code": "200" } }).label).toBe("200");
  });

  it.each([
    [200, "success"],
    [301, "secondary"],
    [404, "warning"],
    [503, "error"],
  ])("maps %s to its severity variant", (code, expected) => {
    expect(getTraceStatus({ attributes: { "response.status.code": code } }).variant).toBe(expected);
  });

  it("uses the span status for non-HTTP entry points such as message workers", () => {
    expect(getTraceStatus({ status: "Error" })).toEqual({
      label: "Error",
      variant: "error",
    });
    expect(getTraceStatus({ status: "Ok" })).toEqual({ label: "OK", variant: "success" });
  });

  it("reports unknown rather than claiming success it cannot vouch for", () => {
    // "Unset" is OpenTelemetry's default for a span nobody marked -- not an assertion of success.
    expect(getTraceStatus({ status: "Unset" }).label).toBe("Unknown");
    expect(getTraceStatus({}).label).toBe("Unknown");
  });
});
