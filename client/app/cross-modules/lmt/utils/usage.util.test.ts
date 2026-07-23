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

  it("maps analytics rows without -api suffix to the correct services", () => {
    const result = getNormalizeUsageMetricsData(
      [
        {
          _id: "blocks-iam-worker",
          TotalRequests: 96,
          Status1xx: 0,
          Status2xx: 0,
          Status3xx: 0,
          Status4xx: 0,
          Status5xx: 0,
          TotalDuration: 271382.1647,
          AverageDuration: 2826.8975489583336,
          PeakDuration: 218393.264,
          TotalThroughput: 0,
          AverageThroughput: null,
        },
        {
          _id: "blocks-utilities-worker",
          TotalRequests: 27,
          Status1xx: 0,
          Status2xx: 0,
          Status3xx: 0,
          Status4xx: 0,
          Status5xx: 0,
          TotalDuration: 83246.8897,
          AverageDuration: 3083.218137037037,
          PeakDuration: 11041.8322,
          TotalThroughput: 0,
          AverageThroughput: null,
        },
        {
          _id: "blocks-iam",
          TotalRequests: 1,
          Status1xx: 0,
          Status2xx: 0,
          Status3xx: 0,
          Status4xx: 1,
          Status5xx: 0,
          TotalDuration: 86444.8812,
          AverageDuration: 86444.8812,
          PeakDuration: 86444.8812,
          TotalThroughput: 178,
          AverageThroughput: 178,
        },
        {
          _id: "blocks-logic",
          TotalRequests: 9,
          Status1xx: 0,
          Status2xx: 1,
          Status3xx: 0,
          Status4xx: 0,
          Status5xx: 8,
          TotalDuration: 284992.6667,
          AverageDuration: 31665.851855555557,
          PeakDuration: 71790.749,
          TotalThroughput: 6736,
          AverageThroughput: 748.4444444444445,
        },
      ],
      payload,
    );

    expect(result.services.iam?.api.TotalRequests).toBe(1);
    expect(result.services.iam?.api.totalError).toBe(1);
    expect(result.services.iam?.api.Status4xx).toBe(1);
    expect(result.services.iam?.worker.TotalRequests).toBe(96);
    expect(result.services.iam?.worker.PeakDuration).toBe(218393.264);

    expect(result.services.logic?.api.TotalRequests).toBe(9);
    expect(result.services.logic?.api.totalSuccess).toBe(1);
    expect(result.services.logic?.api.totalError).toBe(8);
    expect(result.services.logic?.api.Status5xx).toBe(8);

    expect(result.services.utilities?.api.TotalRequests).toBe(0);
    expect(result.services.utilities?.worker.TotalRequests).toBe(27);

    // Accumulators only count API rows (not workers)
    expect(result.accumulatedApiCall).toBe(10);
    expect(result.accumulatedSuccess).toBe(1);
    expect(result.accumulatedError).toBe(9);
  });

  it("also maps blocks-*-api ids when present", () => {
    const result = getNormalizeUsageMetricsData(
      [
        {
          _id: "blocks-monitor-api",
          TotalRequests: 100,
          Status2xx: 80,
          Status4xx: 20,
          TotalDuration: 500,
        } as never,
      ],
      payload,
    );

    expect(result.services.monitor?.api.TotalRequests).toBe(100);
    expect(result.accumulatedApiCall).toBe(100);
    expect(result.accumulatedSuccess).toBe(80);
    expect(result.accumulatedError).toBe(20);
    expect(defaultUsagesMetrics.TotalRequests).toBe(0);
  });
});
