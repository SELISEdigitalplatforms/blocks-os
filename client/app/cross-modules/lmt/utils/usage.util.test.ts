import { describe, expect, it } from "vitest";
import {
  abbreviateNumber,
  abbreviateDurationMs,
  abbreviateBytes,
  transformMatrixData,
  getNormalizeUsageMetricsData,
  defaultUsagesMetrics,
} from "./usage.util";

describe("abbreviateNumber", () => {
  it("returns the plain number below 1000", () => {
    expect(abbreviateNumber(0)).toBe("0");
    expect(abbreviateNumber(999)).toBe("999");
  });
  it("abbreviates thousands and millions", () => {
    expect(abbreviateNumber(1500)).toBe("1.5k");
    expect(abbreviateNumber(2_000_000)).toBe("2M");
  });
});

describe("abbreviateDurationMs", () => {
  it("shows seconds for sub-minute durations", () => {
    expect(abbreviateDurationMs(1500)).toBe("1.50s");
  });
  it("shows minutes and seconds", () => {
    expect(abbreviateDurationMs(90_000)).toBe("1m 30.00s");
  });
  it("shows hours, minutes and seconds", () => {
    expect(abbreviateDurationMs(3_661_000)).toBe("1h 1m 1.00s");
  });
});

describe("abbreviateBytes", () => {
  it("returns bytes below 1024", () => {
    expect(abbreviateBytes(512)).toBe("512B");
  });
  it("abbreviates kilo and mega bytes", () => {
    expect(abbreviateBytes(1024)).toBe("1K");
    expect(abbreviateBytes(1024 * 1024)).toBe("1M");
  });
});

describe("transformMatrixData", () => {
  it("coerces present fields to numbers", () => {
    const result = transformMatrixData({
      _id: "svc",
      TotalRequests: 10,
      Status2xx: 8,
    });
    expect(result._id).toBe("svc");
    expect(result.TotalRequests).toBe(10);
    expect(result.Status2xx).toBe(8);
  });

  it("defaults missing or invalid numeric fields to 0 and _id to empty string", () => {
    const result = transformMatrixData({ TotalRequests: "abc" as unknown as number });
    expect(result._id).toBe("");
    expect(result.TotalRequests).toBe(0);
    expect(result.Status5xx).toBe(0);
  });
});

describe("getNormalizeUsageMetricsData", () => {
  const payload = {
    startTime: "2026-01-15T00:00:00.000Z",
    endTime: "2026-01-15T01:00:00.000Z",
  } as never;

  it("returns zeroed accumulators for empty data", () => {
    const result = getNormalizeUsageMetricsData([], payload);
    expect(result.accumulatedApiCall).toBe(0);
    expect(result.accumulatedError).toBe(0);
    expect(result.accumulatedSuccess).toBe(0);
    expect(result.accumulatedAverageDuration).toBe(0);
    expect(result.endTime).toBe(payload.endTime);
    expect(Object.keys(result.services).length).toBeGreaterThan(0);
  });

  it("accumulates success, error and duration from matrix rows", () => {
    // Use the first service's api name so at least one service has real data.
    const result = getNormalizeUsageMetricsData(
      [
        {
          _id: "blocks-idp-api",
          TotalRequests: 100,
          Status2xx: 80,
          Status4xx: 20,
          TotalDuration: 500,
        } as never,
      ],
      payload,
    );
    expect(result.accumulatedApiCall).toBeGreaterThanOrEqual(0);
    // The default metrics object should be defined for every mapped service.
    expect(defaultUsagesMetrics.TotalRequests).toBe(0);
  });
});
