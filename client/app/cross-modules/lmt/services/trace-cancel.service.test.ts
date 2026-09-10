import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { TraceService } from "./trace.service";
import { RESTORE_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("TraceService.cancelRestoreRequest", () => {
  let service: TraceService;

  beforeEach(() => {
    service = new TraceService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("posts the request id to the cancel endpoint", async () => {
    const response = {
      requestId: "req-1",
      status: "Cancelled",
      cancelled: true,
      message: "Restore request cancelled.",
    };
    vi.mocked(http.post).mockResolvedValue(response);

    const result = await service.cancelRestoreRequest({ RequestId: "req-1" });

    expect(http.post).toHaveBeenCalledWith(RESTORE_ENDPOINTS.CANCEL_REQUEST, {
      requestId: "req-1",
    });
    expect(result).toEqual(response);
  });

  it("surfaces the response unchanged when the restore had already finished", async () => {
    const response = {
      requestId: "req-1",
      status: "Completed",
      cancelled: false,
      message: "Restore request is already Completed and cannot be cancelled.",
    };
    vi.mocked(http.post).mockResolvedValue(response);

    const result = await service.cancelRestoreRequest({ RequestId: "req-1" });

    expect(result.cancelled).toBe(false);
    expect(result.status).toBe("Completed");
  });

  it("throws when the API call fails", async () => {
    vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

    await expect(service.cancelRestoreRequest({ RequestId: "req-1" })).rejects.toThrow(
      "Network error",
    );
  });
});
