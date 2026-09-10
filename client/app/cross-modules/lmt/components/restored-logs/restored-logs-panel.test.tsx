import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRACE_REQUEST_SOURCE_TYPE,
  TRACE_REQUEST_STATUS,
} from "@blocks-lmt/constants/trace.constant";

const h = vi.hoisted(() => ({ getRestoredLogs: vi.fn() }));

vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => "/app/proj/lmt" }));
vi.mock("@blocks-lmt/hooks/use-log", () => ({ useGetRestoredLogs: (...args: unknown[]) => h.getRestoredLogs(...args) }));
// The toolbar has its own tests and pulls the whole filter-toolbar tree in with it.
vi.mock("../logs-header/logs-filter-toolbar", () => ({
  LogsFilterToolbar: () => <div data-testid="logs-filter-toolbar" />,
}));
// Importing the viewer for its context would otherwise drag the hot list, and with it the real
// http client, into the module graph.
vi.mock("../logs-list", () => ({ LogsList: () => null }));
vi.mock("../logs-header/logs-header", () => ({ LogsListHeader: () => null }));

import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { RestoredLogsPanel } from "./restored-logs-panel";

type Ctx = React.ContextType<typeof LogsViewerContext>;

const COMPLETED = {
  requestId: "req-1",
  status: TRACE_REQUEST_STATUS.completed,
  isLoading: false,
  totalFiles: 14,
  processedFiles: 14,
  failedFiles: 0,
  startDate: "2026-08-01T00:00:00Z",
  endDate: "2026-08-07T00:00:00Z",
  expireAt: "2026-09-15T00:00:00Z",
  logRowsRestored: 12480,
  traceRowsRestored: 806,
  refresh: vi.fn(),
};

const NO_REQUEST = {
  requestId: "",
  status: "NoRequest",
  isLoading: false,
  totalFiles: 0,
  processedFiles: 0,
  failedFiles: 0,
  refresh: vi.fn(),
};

const row = (message: string, level = "Error") => ({
  timestamp: "2026-08-03T09:12:41Z",
  level,
  message,
  traceId: "trace-1",
  serviceName: "blocks-iam-api",
});

const renderPanel = (
  restore: Record<string, unknown> = COMPLETED,
  {
    sourceType = TRACE_REQUEST_SOURCE_TYPE.cold,
    ctx = {},
  }: { sourceType?: TRACE_REQUEST_SOURCE_TYPE; ctx?: Partial<Ctx> } = {},
) =>
  render(
    <MemoryRouter>
      <LogsViewerContext.Provider
        value={
          {
            pageSize: 20,
            services: [{ id: "s1", label: "IAM", serviceName: "blocks-iam-api" }],
            selectedService: { id: "s1", label: "IAM", serviceName: "blocks-iam-api" },
            selectedServiceNames: ["blocks-iam-api"],
            filter: { search: "", level: "", startDate: "", endDate: "" },
            isSourceBlocks: true,
            isServicesLoading: false,
            useGenericTraceLinks: true,
            restoreRequestId: restore.requestId,
            tier: sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? "cold" : "archive",
            ...ctx,
          } as unknown as Ctx
        }
      >
        <RestoredLogsPanel sourceType={sourceType} restore={restore as never} />
      </LogsViewerContext.Provider>
    </MemoryRouter>,
  );

const lastQuery = () => h.getRestoredLogs.mock.calls.at(-1)?.[0];

describe("RestoredLogsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getRestoredLogs.mockReturnValue({
      data: { data: [row("SMTP handshake failed")], totalCount: 1 },
      isLoading: false,
      isFetching: false,
    });
  });

  describe("when nothing has been restored", () => {
    it("explains that a restore covers logs as well as traces", () => {
      renderPanel(NO_REQUEST);

      expect(screen.getByText(/no cold logs restored/i)).toBeTruthy();
      expect(screen.getByText(/traces and logs/i)).toBeTruthy();
    });

    it("sends the reader to the tier's own tab in Tracing, where requests are made", () => {
      renderPanel(NO_REQUEST);

      const link = screen.getByRole("link", { name: /go to tracing/i }) as HTMLAnchorElement;
      expect(link.getAttribute("href")).toBe("/app/proj/lmt/tracing?tab=cold");
    });

    it("names the archive tier when that is the one being read", () => {
      renderPanel(NO_REQUEST, { sourceType: TRACE_REQUEST_SOURCE_TYPE.archive });

      expect(screen.getByText(/no archived logs restored/i)).toBeTruthy();
      expect(
        (screen.getByRole("link", { name: /go to tracing/i }) as HTMLAnchorElement).getAttribute(
          "href",
        ),
      ).toBe("/app/proj/lmt/tracing?tab=archive");
    });

    it("fetches no rows when there is no request to ask about", () => {
      renderPanel(NO_REQUEST);

      // The hook is still called -- hooks always are -- but the query stays switched off, so
      // nothing is asked of an endpoint that would answer with an error.
      expect(h.getRestoredLogs.mock.calls.at(-1)?.[1]).toMatchObject({ enabled: false });
    });
  });

  describe("while the restore is running", () => {
    const running = { ...COMPLETED, status: TRACE_REQUEST_STATUS.processing, processedFiles: 9 };

    it("reports how far it has got", () => {
      renderPanel(running);

      expect(screen.getByText(/9 of 14 files/i)).toBeTruthy();
    });

    it("re-reads the status on request, so a finished restore appears without a reload", async () => {
      const refresh = vi.fn();
      renderPanel({ ...running, refresh });

      await userEvent.click(screen.getByRole("button", { name: /refresh/i }));

      expect(refresh).toHaveBeenCalledTimes(1);
    });

    /** Cancelling belongs to the page that owns the request, so this one only points at it. */
    it("offers no cancel of its own", () => {
      renderPanel(running);

      expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
      expect(screen.getByRole("link", { name: /view.*tracing/i })).toBeTruthy();
    });
  });

  describe("when the restore is readable", () => {
    it("names the window, the rows in it and when they go", () => {
      renderPanel();

      expect(screen.getByText(/Aug 1 – Aug 7, 2026/)).toBeTruthy();
      expect(screen.getByText(/12,480 log rows/)).toBeTruthy();
      expect(screen.getByText(/expires/i)).toBeTruthy();
    });

    it("lists the restored rows", () => {
      renderPanel();

      expect(screen.getByText("SMTP handshake failed")).toBeTruthy();
    });

    it("asks only for the rows of this restore, from the first page", () => {
      renderPanel();

      expect(lastQuery()).toMatchObject({
        requestId: "req-1",
        page: 0,
        pageSize: 20,
        serviceNames: ["blocks-iam-api"],
      });
    });

    it("carries the reader's filters into the query", () => {
      renderPanel(COMPLETED, {
        ctx: {
          filter: {
            search: "smtp",
            level: "Error",
            startDate: "2026-08-03T00:00:00Z",
            endDate: "2026-08-04T00:00:00Z",
          },
        } as Partial<Ctx>,
      });

      expect(lastQuery()).toMatchObject({
        search: "smtp",
        filter: {
          level: "Error",
          startDate: "2026-08-03T00:00:00Z",
          endDate: "2026-08-04T00:00:00Z",
        },
      });
    });

    /**
     * The restored list is paged rather than tailing: there is no "now" to stream towards, and
     * the window it reads is closed.
     */
    it("pages through a restore larger than one page", async () => {
      h.getRestoredLogs.mockReturnValue({
        data: { data: [row("first page row")], totalCount: 45 },
        isLoading: false,
        isFetching: false,
      });
      renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /next|2/i }));

      await waitFor(() => expect(lastQuery()?.page).toBe(1));
    });

    /**
     * Narrowing a filter while deep in the pages would otherwise leave the reader on a page
     * past the end of the new result, which looks exactly like an empty restore.
     */
    it("returns to the first page when the reader narrows the filter", async () => {
      h.getRestoredLogs.mockReturnValue({
        data: { data: [row("a row")], totalCount: 45 },
        isLoading: false,
        isFetching: false,
      });
      const { rerender } = renderPanel();

      await userEvent.click(screen.getByRole("button", { name: /go to next page/i }));
      await waitFor(() => expect(lastQuery()?.page).toBe(1));

      rerender(
        <MemoryRouter>
          <LogsViewerContext.Provider
            value={
              {
                pageSize: 20,
                services: [],
                selectedService: { id: "s1", label: "IAM", serviceName: "blocks-iam-api" },
                selectedServiceNames: ["blocks-iam-api"],
                filter: { search: "smtp", level: "", startDate: "", endDate: "" },
                isSourceBlocks: true,
                isServicesLoading: false,
                useGenericTraceLinks: true,
                restoreRequestId: "req-1",
                tier: "cold",
              } as unknown as Ctx
            }
          >
            <RestoredLogsPanel sourceType={TRACE_REQUEST_SOURCE_TYPE.cold} restore={COMPLETED as never} />
          </LogsViewerContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => expect(lastQuery()?.page).toBe(0));
      expect(lastQuery()?.search).toBe("smtp");
    });

    it("offers no pager when everything fits on one page", () => {
      renderPanel();

      expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    });

    it("says so when the reader's filters match none of the restored rows", () => {
      h.getRestoredLogs.mockReturnValue({
        data: { data: [], totalCount: 0 },
        isLoading: false,
        isFetching: false,
      });
      renderPanel(COMPLETED, { ctx: { filter: { search: "nothing matches this" } } as Partial<Ctx> });

      expect(screen.getByText(/no logs match/i)).toBeTruthy();
    });

    /**
     * A range whose days held traces but no logs completes with zero log rows. Saying the restore
     * is empty is honest; an empty list under a filter toolbar reads as a broken page.
     */
    it("distinguishes an empty restore from an empty result", () => {
      h.getRestoredLogs.mockReturnValue({
        data: { data: [], totalCount: 0 },
        isLoading: false,
        isFetching: false,
      });
      renderPanel({ ...COMPLETED, logRowsRestored: 0 });

      expect(screen.getByText(/no log rows/i)).toBeTruthy();
    });

    it("warns that a partial restore is incomplete, while still showing what came back", () => {
      renderPanel({ ...COMPLETED, status: TRACE_REQUEST_STATUS.partialSuccess, failedFiles: 2 });

      expect(screen.getByText(/incomplete/i)).toBeTruthy();
      expect(screen.getByText("SMTP handshake failed")).toBeTruthy();
    });
  });

  describe("when the restore did not survive", () => {
    it("explains a failure and offers the way to retry it", () => {
      renderPanel({ ...COMPLETED, status: TRACE_REQUEST_STATUS.failed });

      expect(screen.getByText(/failed/i)).toBeTruthy();
      expect(screen.getByRole("link", { name: /go to tracing/i })).toBeTruthy();
    });

    it("explains a cancellation, including that the partial rows were discarded", () => {
      renderPanel({ ...COMPLETED, status: TRACE_REQUEST_STATUS.cancelled });

      expect(screen.getByText(/cancelled/i)).toBeTruthy();
      expect(screen.getByText(/discarded/i)).toBeTruthy();
    });
  });

  /** Without this the panel flashes "nothing restored" on every load before the status lands. */
  it("waits for the status rather than claiming nothing was restored", () => {
    renderPanel({ ...NO_REQUEST, isLoading: true });

    expect(screen.queryByText(/no cold logs restored/i)).toBeNull();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });
});
