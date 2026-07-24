import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { lmtService } from "./lmt.service";
import { LogService } from "./log.service";
import { TraceService } from "./trace.service";
import { UsageService } from "./usage.service";
import { LOG_ENDPOINTS, TRACE_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("lmtService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("composes log, trace and usage services", () => {
    expect(lmtService.log).toBeInstanceOf(LogService);
    expect(lmtService.trace).toBeInstanceOf(TraceService);
    expect(lmtService.usage).toBeInstanceOf(UsageService);
  });

  it("log.getLogs delegates to http.post on the logs endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({ data: [] } as never);
    const payload = { page: 1, pageSize: 10 } as never;
    await lmtService.log.getLogs(payload);
    expect(http.post).toHaveBeenCalledWith(LOG_ENDPOINTS.GET_LOGS, payload);
  });

  it("usage.getOperationalAnalytics delegates to http.post on the trace endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue([] as never);
    const payload = { from: "a", to: "b" } as never;
    await lmtService.usage.getOperationalAnalytics(payload);
    expect(http.post).toHaveBeenCalledWith(
      TRACE_ENDPOINTS.GET_OPERATIONAL_ANALYTICS,
      payload,
    );
  });
});
