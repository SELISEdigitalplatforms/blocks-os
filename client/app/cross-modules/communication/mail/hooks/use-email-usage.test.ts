import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_USAGE_REFETCH_INTERVAL } from "../constants/email-usage";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import {
  mockEmailServiceFactory,
  mockEmailUsageResponse,
  mockGetMailBoxMailResponse,
} from "../../test-utils/__mocks__";
// Need to import the mocks for the services and project store before the hooks to ensure the mocks are applied correctly
import { emailService } from "@blocks-communication/mail/services/email.services";
import {
  emailUsageSourceQueryKey,
  fetchEmailUsageSource,
  useFetchEmailUsageSource,
  useGetEmailUsage,
  useGetEmailUsageById,
  useGetEmailUsageSource,
} from "./use-email-usage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { act } from "react";

vi.mock("@blocks-communication/mail/services/email.services", () => mockEmailServiceFactory());
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  ...mockProjectStoreFactory(),
}));

describe("Email Usage Hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("useGetEmailUsage", () => {
    it("should fetch email usage successfully with all filters", async () => {
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(
        () =>
          useGetEmailUsage(0, 10, false, "test search", "Delivered", "2024-01-01", "2024-01-31"),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        data: mockEmailUsageResponse.mails,
        totalCount: mockEmailUsageResponse.totalCount,
      });
      expect(emailService.getMailBoxMails).toHaveBeenCalledWith(
        0,
        10,
        false,
        "test search",
        "Delivered",
        "2024-01-01",
        "2024-01-31",
        undefined,
      );
    });

    it("should fetch inbound emails", async () => {
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(emailService.getMailBoxMails).toHaveBeenCalledWith(
        0,
        10,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should use correct query key with all parameters", async () => {
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(
        () => useGetEmailUsage(2, 20, false, "test", "Sent", "2024-01-01", "2024-01-31"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Query key should include all parameters
      expect(emailService.getMailBoxMails).toHaveBeenCalledWith(
        2,
        20,
        false,
        "test",
        "Sent",
        "2024-01-01",
        "2024-01-31",
        undefined,
      );
    });

    it("should auto-refetch every 20 seconds", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      // Initial fetching on mount
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(emailService.getMailBoxMails).toHaveBeenCalledTimes(1);

      // Advance fake timers to trigger react-query's refetchInterval
      await act(() => vi.advanceTimersByTimeAsync(EMAIL_USAGE_REFETCH_INTERVAL));
      expect(emailService.getMailBoxMails).toHaveBeenCalledTimes(2);
    });

    it("should be disabled when tenantId is empty", async () => {
      const { useProjectStore } = await import("@seliseblocks/genesis-os");
      vi.mocked(useProjectStore).mockReturnValueOnce({
        selectedProject: { tenantId: "" },
      });

      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      // Query should not run when disabled
      expect(result.current.isLoading).toBe(false);
      expect(emailService.getMailBoxMails).not.toHaveBeenCalled();
    });

    it("should return empty data when tenantId is empty but query runs", async () => {
      const { useProjectStore } = await import("@seliseblocks/genesis-os");
      vi.mocked(useProjectStore).mockReturnValueOnce({
        selectedProject: { tenantId: "" },
      });

      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      // Since enabled: !!tenantId, query won't run
      expect(result.current.data).toBeUndefined();
    });

    it("should handle API errors", async () => {
      vi.mocked(emailService.getMailBoxMails).mockRejectedValue(
        new Error("Failed to fetch email usage"),
      );

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it("should handle optional filters being undefined", async () => {
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(emailService.getMailBoxMails).toHaveBeenCalledWith(
        0,
        10,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should transform response data correctly", async () => {
      vi.mocked(emailService.getMailBoxMails).mockResolvedValue(mockEmailUsageResponse);

      const { result } = renderHook(() => useGetEmailUsage(0, 10, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should transform the response to include data and totalCount
      expect(result.current.data).toEqual({
        data: mockEmailUsageResponse.mails,
        totalCount: mockEmailUsageResponse.totalCount,
      });
    });
  });

  describe("useGetEmailUsageById", () => {
    it("should fetch single email by ID successfully", async () => {
      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById("msg-123"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockGetMailBoxMailResponse.mail);
      expect(emailService.getMailBoxMail).toHaveBeenCalledWith("msg-123");
    });

    it("should use correct query key for caching", async () => {
      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById("msg-456"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(emailService.getMailBoxMail).toHaveBeenCalledWith("msg-456");
    });

    it("should be disabled when tenantId is empty", async () => {
      const { useProjectStore } = await import("@seliseblocks/genesis-os");
      vi.mocked(useProjectStore).mockReturnValueOnce({
        selectedProject: { tenantId: "" },
      });

      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById("msg-123"), {
        wrapper: createWrapper(),
      });

      // Query should not run when disabled
      expect(result.current.isLoading).toBe(false);
      expect(emailService.getMailBoxMail).not.toHaveBeenCalled();
    });

    it("should be disabled when id is empty", async () => {
      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById(""), {
        wrapper: createWrapper(),
      });

      // Query should not run when id is empty
      expect(result.current.isLoading).toBe(false);
      expect(emailService.getMailBoxMail).not.toHaveBeenCalled();
    });

    it("should return null when tenantId is empty but query runs", async () => {
      const { useProjectStore } = await import("@seliseblocks/genesis-os");
      vi.mocked(useProjectStore).mockReturnValueOnce({
        selectedProject: { tenantId: "" },
      });

      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById("msg-123"), {
        wrapper: createWrapper(),
      });

      // Since enabled: !!tenantId && !!id, query won't run
      expect(result.current.data).toBeUndefined();
    });

    it("should handle API errors", async () => {
      vi.mocked(emailService.getMailBoxMail).mockRejectedValue(new Error("Email not found"));

      const { result } = renderHook(() => useGetEmailUsageById("invalid-id"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });

    it("should extract mail from response correctly", async () => {
      vi.mocked(emailService.getMailBoxMail).mockResolvedValue(mockGetMailBoxMailResponse);

      const { result } = renderHook(() => useGetEmailUsageById("msg-123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should return just the mail object, not the full response
      expect(result.current.data).toEqual(mockGetMailBoxMailResponse.mail);
      expect(result.current.data).not.toHaveProperty("errors");
      expect(result.current.data).not.toHaveProperty("isSuccess");
    });
  });

  describe("message source", () => {
    const SOURCE = new Uint8Array([0x53, 0x80, 0xff]);
    const sourceBlob = () => new Blob([SOURCE], { type: "application/octet-stream" });

    // Library defaults (retry: 3), so the hook's own `retry: false` is what is tested.
    const withClient = (client = new QueryClient()) => {
      const Wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);
      return { client, wrapper: Wrapper };
    };

    it("keys the cache entry by message and tenant", () => {
      expect(emailUsageSourceQueryKey("row-1", "tenant-1")).toEqual([
        "email-usage-source",
        "row-1",
        "tenant-1",
      ]);
    });

    it("returns the file's bytes unchanged", async () => {
      vi.mocked(emailService.getMailBoxMailSource).mockResolvedValue(sourceBlob());
      await expect(fetchEmailUsageSource("row-1")).resolves.toEqual(SOURCE);
      expect(emailService.getMailBoxMailSource).toHaveBeenCalledWith("row-1");
    });

    it("does not fetch while disabled", () => {
      const { wrapper } = withClient();
      const { result } = renderHook(() => useGetEmailUsageSource("row-1", false), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(emailService.getMailBoxMailSource).not.toHaveBeenCalled();
    });

    it("fetches once enabled, under the tenant's key", async () => {
      vi.mocked(emailService.getMailBoxMailSource).mockResolvedValue(sourceBlob());
      const { client, wrapper } = withClient();
      const { result } = renderHook(() => useGetEmailUsageSource("row-1", true), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(SOURCE);
      expect(client.getQueryData(["email-usage-source", "row-1", "test-tenant-id-123"])).toEqual(
        SOURCE,
      );
    });

    it("does not fetch without a tenant or an id", async () => {
      const { useProjectStore } = await import("@seliseblocks/genesis-os");
      vi.mocked(useProjectStore).mockReturnValueOnce({ selectedProject: { tenantId: "" } });
      const { wrapper } = withClient();
      renderHook(() => useGetEmailUsageSource("row-1", true), { wrapper });
      renderHook(() => useGetEmailUsageSource("", true), { wrapper: withClient().wrapper });

      expect(emailService.getMailBoxMailSource).not.toHaveBeenCalled();
    });

    it("does not retry a failed request", async () => {
      vi.mocked(emailService.getMailBoxMailSource).mockRejectedValue(new Error("404"));
      const { wrapper } = withClient();
      const { result } = renderHook(() => useGetEmailUsageSource("row-1", true), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(emailService.getMailBoxMailSource).toHaveBeenCalledTimes(1);
    });

    it("on demand, reuses a source that is already loaded", async () => {
      vi.mocked(emailService.getMailBoxMailSource).mockResolvedValue(sourceBlob());
      const { wrapper } = withClient();
      const { result } = renderHook(
        () => ({
          query: useGetEmailUsageSource("row-1", true),
          fetchSource: useFetchEmailUsageSource("row-1"),
        }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

      await expect(result.current.fetchSource()).resolves.toEqual(SOURCE);
      expect(emailService.getMailBoxMailSource).toHaveBeenCalledTimes(1);
    });

    it("on demand, fetches into the shared entry and does not retry a failure", async () => {
      vi.mocked(emailService.getMailBoxMailSource)
        .mockRejectedValueOnce(new Error("404"))
        .mockResolvedValueOnce(sourceBlob());
      const { client, wrapper } = withClient();
      const { result } = renderHook(() => useFetchEmailUsageSource("row-1"), { wrapper });

      await expect(result.current()).rejects.toThrow("404");
      expect(emailService.getMailBoxMailSource).toHaveBeenCalledTimes(1);

      await expect(result.current()).resolves.toEqual(SOURCE);
      expect(client.getQueryData(emailUsageSourceQueryKey("row-1", "test-tenant-id-123"))).toEqual(
        SOURCE,
      );
    });
  });
});
