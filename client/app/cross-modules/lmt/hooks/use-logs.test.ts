import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import {
  mockLmtServiceFactory,
  mockLogsResponse,
  mockEmptyLogsResponse,
} from "../test-utils/__mocks__";
import { lmtService } from "../services/lmt.service";
import { useLogs } from "./use-logs";

vi.mock("@blocks-lmt/services/lmt.service", () => mockLmtServiceFactory());
vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());

describe("useLogs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── Initial fetch ────────────────────────────────────────────────────────
  describe("initial fetch", () => {
    it("should fetch initial logs on mount", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse);

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(lmtService.log.getLogsByDate).toHaveBeenCalledWith(
        expect.not.objectContaining({ projectKey: expect.anything() }),
      );
      expect(result.current.initialLogs).toHaveLength(2);
    });

    it("should set isLoading to false after fetch", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockEmptyLogsResponse);

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should handle fetch error gracefully", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.initialLogs).toHaveLength(0);
    });

    it("should refetch when serviceName changes", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse)

      const { rerender } = renderHook(
        ({ serviceName }: { serviceName: string }) => useLogs({ serviceName }),
        { initialProps: { serviceName: "blocks-iam" } },
      )

      await waitFor(() =>
        expect(lmtService.log.getLogsByDate).toHaveBeenCalledWith(
          expect.objectContaining({ serviceName: "blocks-iam" }),
        ),
      )

      rerender({ serviceName: "blocks-monitor" })

      await waitFor(() =>
        expect(lmtService.log.getLogsByDate).toHaveBeenLastCalledWith(
          expect.objectContaining({ serviceName: "blocks-monitor" }),
        ),
      )
    })

    it("should dedupe concurrent initial fetches with identical params", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse)

      const { unmount: unmountA } = renderHook(() =>
        useLogs({ serviceName: "blocks-iam" }),
      )
      const { unmount: unmountB } = renderHook(() =>
        useLogs({ serviceName: "blocks-iam" }),
      )

      await waitFor(() => expect(lmtService.log.getLogsByDate).toHaveBeenCalledTimes(1))

      unmountA()
      unmountB()
    })
  })

  // ─── fetchOldLogs ─────────────────────────────────────────────────────────
  describe("fetchOldLogs", () => {
    it("should fetch older logs with endDate", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse);

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let oldLogs: unknown[];
      await act(async () => {
        oldLogs = await result.current.fetchOldLogs("2026-01-15T10:00:00.000Z");
      });

      expect(oldLogs!).toHaveLength(2);
      expect(lmtService.log.getLogsByDate).toHaveBeenCalledTimes(2);
    });

    it("should return empty array on error", async () => {
      vi.mocked(lmtService.log.getLogsByDate)
        .mockResolvedValueOnce(mockLogsResponse) // initial fetch
        .mockRejectedValueOnce(new Error("fail")); // fetchOldLogs

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let oldLogs: unknown[];
      await act(async () => {
        oldLogs = await result.current.fetchOldLogs("2026-01-15T10:00:00.000Z");
      });

      expect(oldLogs!).toEqual([]);
    });
  });

  // ─── fetchNewLogs ─────────────────────────────────────────────────────────
  describe("fetchNewLogs", () => {
    it("should fetch new logs via live endpoint", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse);
      vi.mocked(lmtService.log.getLiveLog).mockResolvedValue(mockLogsResponse);

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let newLogs: unknown[];
      await act(async () => {
        newLogs = await result.current.fetchNewLogs("2026-01-15T10:30:00.000Z");
      });

      expect(newLogs!).toHaveLength(2);
      expect(lmtService.log.getLiveLog).toHaveBeenCalled();
    });

    it("should return empty array when serviceName is empty", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse);

      const { result } = renderHook(() => useLogs({ serviceName: "" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let newLogs: unknown[];
      await act(async () => {
        newLogs = await result.current.fetchNewLogs("2026-01-15T10:30:00.000Z");
      });

      expect(newLogs!).toEqual([]);
    });

    it("should return empty array on error", async () => {
      vi.mocked(lmtService.log.getLogsByDate).mockResolvedValue(mockLogsResponse);
      vi.mocked(lmtService.log.getLiveLog).mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useLogs({ serviceName: "blocks-idp-api" }));
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let newLogs: unknown[];
      await act(async () => {
        newLogs = await result.current.fetchNewLogs("2026-01-15T10:30:00.000Z");
      });

      expect(newLogs!).toEqual([]);
    });
  });
});
