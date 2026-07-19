import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { notificationService } from "@/services/notification.service";
import {
  useGetNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useGetNotificationConfigs,
  useSaveNotificationConfig,
  useDeleteNotificationConfig,
} from "./use-notifications";

vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());
vi.mock("@/services/notification.service", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllNotificationsAsRead: vi.fn(),
    getNotificationConfigs: vi.fn(),
    saveNotificationConfig: vi.fn(),
    deleteNotificationConfig: vi.fn(),
  },
}));

describe("use-notifications hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetNotifications fetches the requested page", async () => {
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      notifications: [],
      totalNotificationsCount: 0,
      unReadNotificationsCount: 0,
    });
    const { result } = renderHook(() => useGetNotifications(1, 10), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationService.getNotifications).toHaveBeenCalledWith(1, 10);
  });

  it("useMarkAsRead calls the service", async () => {
    vi.mocked(notificationService.markAsRead).mockResolvedValue({
      isSuccess: true,
      errors: null,
    });
    const { result } = renderHook(() => useMarkAsRead(), { wrapper: createWrapper() });
    await result.current.mutateAsync("n-1");
    expect(vi.mocked(notificationService.markAsRead).mock.calls[0][0]).toBe("n-1");
  });

  it("useMarkAllAsRead calls the service", async () => {
    vi.mocked(notificationService.markAllNotificationsAsRead).mockResolvedValue({
      isSuccess: true,
      errors: null,
    });
    const { result } = renderHook(() => useMarkAllAsRead(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync(undefined);
    expect(notificationService.markAllNotificationsAsRead).toHaveBeenCalled();
  });

  it("useGetNotificationConfigs passes the tenant id from the project store", async () => {
    vi.mocked(notificationService.getNotificationConfigs).mockResolvedValue({
      configurations: [],
      totalCount: 0,
      isSuccess: true,
      errors: null,
    });
    const { result } = renderHook(() => useGetNotificationConfigs(0, 5), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationService.getNotificationConfigs).toHaveBeenCalledWith(
      0,
      5,
      "test-tenant-id-123",
    );
  });

  it("useSaveNotificationConfig calls the service", async () => {
    vi.mocked(notificationService.saveNotificationConfig).mockResolvedValue({
      isSuccess: true,
      errors: null,
    });
    const { result } = renderHook(() => useSaveNotificationConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ name: "cfg" } as never);
    expect(notificationService.saveNotificationConfig).toHaveBeenCalled();
  });

  it("useDeleteNotificationConfig calls the service", async () => {
    vi.mocked(notificationService.deleteNotificationConfig).mockResolvedValue({
      isSuccess: true,
      errors: null,
    });
    const { result } = renderHook(() => useDeleteNotificationConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({ itemId: "c-1", projectKey: "pk" });
    expect(
      vi.mocked(notificationService.deleteNotificationConfig).mock.calls[0][0],
    ).toEqual({ itemId: "c-1", projectKey: "pk" });
  });
});
