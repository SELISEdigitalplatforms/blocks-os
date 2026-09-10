import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRACE_REQUEST_SOURCE_TYPE, TRACE_REQUEST_STATUS } from "@blocks-lmt/constants/trace.constant";

const h = vi.hoisted(() => ({
  getRequestId: vi.fn(),
  getTraceStatus: vi.fn(),
}));

vi.mock("@blocks-lmt/services/lmt.service", () => ({
  lmtService: { trace: { getRequestId: h.getRequestId, getTraceStatus: h.getTraceStatus } },
}));

import { NO_RESTORE_REQUEST, useRestoreRequest } from "./use-restore-request";

const COMPLETED_STATUS = {
  requestId: "req-1",
  status: TRACE_REQUEST_STATUS.completed,
  totalFiles: 14,
  processedFiles: 14,
  failedFiles: 0,
  startDate: "2026-08-01T00:00:00Z",
  endDate: "2026-08-07T00:00:00Z",
  logRowsRestored: 12480,
  traceRowsRestored: 806,
  expireAt: "2026-09-15T00:00:00Z",
  sourceType: "Cold",
};

const renderRestoreRequest = (
  overrides: Partial<Parameters<typeof useRestoreRequest>[0]> = {},
) =>
  renderHook(
    () =>
      useRestoreRequest({
        sourceType: TRACE_REQUEST_SOURCE_TYPE.cold,
        projectKey: "proj-1",
        ...overrides,
      }),
    { wrapper: createWrapper() },
  );

describe("useRestoreRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getRequestId.mockResolvedValue({ requestId: "req-1" });
    h.getTraceStatus.mockResolvedValue(COMPLETED_STATUS);
  });

  it("reads the window of the restore that exists", async () => {
    const { result } = renderRestoreRequest();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.requestId).toBe("req-1");
    expect(result.current.status).toBe(TRACE_REQUEST_STATUS.completed);
    expect(result.current.startDate).toBe("2026-08-01T00:00:00Z");
    expect(result.current.endDate).toBe("2026-08-07T00:00:00Z");
    expect(result.current.logRowsRestored).toBe(12480);
    expect(result.current.expireAt).toBe("2026-09-15T00:00:00Z");
    expect(result.current.processedFiles).toBe(14);
    expect(result.current.totalFiles).toBe(14);
  });

  it("asks about the tier it was given", async () => {
    const { result } = renderRestoreRequest({ sourceType: TRACE_REQUEST_SOURCE_TYPE.archive });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(h.getRequestId).toHaveBeenCalledWith({
      ProjectKey: "proj-1",
      SourceType: TRACE_REQUEST_SOURCE_TYPE.archive,
    });
    expect(h.getTraceStatus).toHaveBeenCalledWith({
      RequestId: "req-1",
      SourceType: TRACE_REQUEST_SOURCE_TYPE.archive,
    });
  });

  it("reports no request when the tier has never been restored", async () => {
    h.getRequestId.mockResolvedValue({ requestId: "" });

    const { result } = renderRestoreRequest();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe(NO_RESTORE_REQUEST);
    expect(result.current.requestId).toBe("");
    expect(h.getTraceStatus).not.toHaveBeenCalled();
  });

  /**
   * The status of an expired or purged request answers with an error. Reading that as "nothing
   * restored" is what lets the page offer a way forward instead of showing a broken panel.
   */
  it("reports no request when the lookup fails", async () => {
    h.getTraceStatus.mockRejectedValue(new Error("not found"));

    const { result } = renderRestoreRequest();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe(NO_RESTORE_REQUEST);
  });

  it("stays quiet until a project is selected", async () => {
    const { result } = renderRestoreRequest({ projectKey: "" });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(h.getRequestId).not.toHaveBeenCalled();
    expect(result.current.status).toBe(NO_RESTORE_REQUEST);
  });

  /** Hot needs no request, and asking for one would cost a round trip per page load. */
  it("asks nothing when it is switched off", async () => {
    const { result } = renderRestoreRequest({ enabled: false });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(h.getRequestId).not.toHaveBeenCalled();
  });

  it("re-reads the status on demand, so a finished restore appears without a reload", async () => {
    h.getTraceStatus.mockResolvedValue({ ...COMPLETED_STATUS, status: TRACE_REQUEST_STATUS.processing });

    const { result } = renderRestoreRequest();
    await waitFor(() => expect(result.current.status).toBe(TRACE_REQUEST_STATUS.processing));

    h.getTraceStatus.mockResolvedValue(COMPLETED_STATUS);
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.status).toBe(TRACE_REQUEST_STATUS.completed));
  });

  it("re-reads when the reader switches project", async () => {
    const { result, rerender } = renderHook(
      ({ projectKey }: { projectKey: string }) =>
        useRestoreRequest({ sourceType: TRACE_REQUEST_SOURCE_TYPE.cold, projectKey }),
      { initialProps: { projectKey: "proj-1" }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ projectKey: "proj-2" });

    await waitFor(() =>
      expect(h.getRequestId).toHaveBeenCalledWith({
        ProjectKey: "proj-2",
        SourceType: TRACE_REQUEST_SOURCE_TYPE.cold,
      }),
    );
  });
});
