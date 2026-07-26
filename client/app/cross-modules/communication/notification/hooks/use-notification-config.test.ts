import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { notificationConfigService } from "../services/notification-config.service";
import {
  notificationConfigsQueryKey,
  useGetNotificationConfigs,
  useSaveNotificationConfig,
  useDeleteNotificationConfig,
} from "./use-notification-config";

vi.mock("../services/notification-config.service", () => ({
  notificationConfigService: {
    getNotificationConfigs: vi.fn(),
    saveNotificationConfig: vi.fn(),
    deleteNotificationConfig: vi.fn(),
  },
}));

describe("use-notification-config hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notificationConfigsQueryKey defaults searchText to an empty string", () => {
    expect(
      notificationConfigsQueryKey({ projectKey: "pk", page: 1, pageSize: 10 } as never),
    ).toEqual(["notification-configs", "pk", 1, 10, ""]);
  });

  it("useGetNotificationConfigs is disabled without a project key", () => {
    const { result } = renderHook(() => useGetNotificationConfigs({ projectKey: "" } as never), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetNotificationConfigs fetches configs", async () => {
    vi.mocked(notificationConfigService.getNotificationConfigs).mockResolvedValue({} as never);
    const { result } = renderHook(
      () => useGetNotificationConfigs({ projectKey: "pk", page: 1, pageSize: 10 } as never),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notificationConfigService.getNotificationConfigs).toHaveBeenCalled();
  });

  it("useSaveNotificationConfig saves a config", async () => {
    vi.mocked(notificationConfigService.saveNotificationConfig).mockResolvedValue({} as never);
    const { result } = renderHook(() => useSaveNotificationConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync({} as never);
    expect(notificationConfigService.saveNotificationConfig).toHaveBeenCalled();
  });

  it("useDeleteNotificationConfig deletes by id", async () => {
    vi.mocked(notificationConfigService.deleteNotificationConfig).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteNotificationConfig(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync("c-1");
    expect(vi.mocked(notificationConfigService.deleteNotificationConfig).mock.calls[0][0]).toBe(
      "c-1",
    );
  });
});
