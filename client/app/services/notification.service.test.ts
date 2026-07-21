import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { NotificationService } from "./notification.service";
import {
  NOTIFICATION_CONFIG_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
} from "@/constants/notification.constant";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

const ABS = { absoluteUrl: true };

describe("NotificationService", () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    vi.clearAllMocks();
    // Empty base url keeps assertions on the path only.
    (window as BlocksWindow).__BLOCKS_ENV__ = { BLOCKS_LOGIC_BASE_URL: "" };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  it("getNotifications converts the 1-based page to 0-based and passes pageSize", async () => {
    vi.mocked(http.get).mockResolvedValue({
      notifications: [],
      totalNotificationsCount: 0,
      unReadNotificationsCount: 0,
    });
    await service.getNotifications(3, 20);
    expect(http.get).toHaveBeenCalledWith(
      `${NOTIFICATION_ENDPOINTS.GET_NOTIFICATIONS}?page=2&pageSize=20`,
      undefined,
      ABS,
    );
  });

  it("markAsRead POSTs the notification id", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });
    await service.markAsRead("n-1");
    expect(http.post).toHaveBeenCalledWith(
      NOTIFICATION_ENDPOINTS.MARK_AS_READ,
      { id: "n-1" },
      undefined,
      ABS,
    );
  });

  it("markAllNotificationsAsRead POSTs an empty body", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });
    await service.markAllNotificationsAsRead();
    expect(http.post).toHaveBeenCalledWith(
      NOTIFICATION_ENDPOINTS.MARK_ALL_AS_READ,
      {},
      undefined,
      ABS,
    );
  });

  it("getNotificationConfigs builds the paged query", async () => {
    vi.mocked(http.get).mockResolvedValue({
      configurations: [],
      totalCount: 0,
      isSuccess: true,
      errors: null,
    });
    await service.getNotificationConfigs(1, 5, "pk");
    expect(http.get).toHaveBeenCalledWith(
      `${NOTIFICATION_CONFIG_ENDPOINTS.GET_CONFIGS}?page=1&pageSize=5&projectKey=pk`,
      undefined,
      ABS,
    );
  });

  it("deleteNotificationConfig uses DELETE with itemId and projectKey", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true, errors: null });
    await service.deleteNotificationConfig({ itemId: "c-1", projectKey: "pk" });
    expect(http.delete).toHaveBeenCalledWith(
      `${NOTIFICATION_CONFIG_ENDPOINTS.DELETE_CONFIG}?itemId=c-1&projectKey=pk`,
      undefined,
      ABS,
    );
  });

  describe("getNotificationConfig (event dispatch)", () => {
    it("dispatches a CustomEvent with a parsed JSON message", () => {
      const spy = vi.spyOn(window, "dispatchEvent");
      const config = { notifyMethod: "onOrder" } as never;
      service.getNotificationConfig(config, '{"amount":5}');
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe("onOrder");
      expect(event.detail.message).toEqual({ amount: 5 });
      expect(event.detail.method).toBe("onOrder");
      spy.mockRestore();
    });

    it("keeps the raw message when it is not valid JSON", () => {
      const spy = vi.spyOn(window, "dispatchEvent");
      const config = { notifyMethod: "onOrder" } as never;
      service.getNotificationConfig(config, "plain text");
      const event = spy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.message).toBe("plain text");
      spy.mockRestore();
    });
  });
});
