import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/lib/http/http-client";
import { NotificationConfigService } from "./notification-config.service";

vi.mock("@/lib/http/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const NOTIFICATION_GETS_ENDPOINT = "/api/Notification/Gets";
const NOTIFICATION_GET_ENDPOINT = "/api/Notification/Get";
const NOTIFICATION_SAVE_ENDPOINT = "/api/Notification/Save";
const NOTIFICATION_DELETE_ENDPOINT = "/api/Notification/Delete";

describe("NotificationConfigService", () => {
  let service: NotificationConfigService;

  beforeEach(() => {
    service = new NotificationConfigService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotificationConfigs", () => {
    it("should GET Notification/Gets with projectKey and pagination", async () => {
      vi.mocked(http.get).mockResolvedValue({
        isSuccess: true,
        totalCount: 1,
        configurations: [
          {
            itemId: "cfg-1",
            name: "Test",
            channelToNotify: 0,
            notificationType: 0,
            enablePersistence: true,
            notifyMethod: "SendAsync",
          },
        ],
      });

      const result = await service.getNotificationConfigs({
        projectKey: "proj-1",
        page: 0,
        pageSize: 10,
      });

      expect(http.get).toHaveBeenCalledWith(
        `${NOTIFICATION_GETS_ENDPOINT}?page=0&pageSize=10&projectKey=proj-1`,
      );
      expect(result.configurations[0]).toMatchObject({
        itemId: "cfg-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 0,
        enablePersistence: true,
        notifyMethod: "SendAsync",
      });
      expect(result.totalCount).toBe(1);
    });
  });

  describe("saveNotificationConfig", () => {
    it("should POST /api/Notification/Save with flat payload and isUpdateRequest flag for edits", async () => {
      vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });

      const result = await service.saveNotificationConfig({
        projectKey: "proj-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "SendAsync",
        itemId: "cfg-1",
      });

      expect(http.post).toHaveBeenCalledWith(NOTIFICATION_SAVE_ENDPOINT, {
        name: "Test",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "SendAsync",
        itemId: "cfg-1",
        isUpdateRequest: true,
      });
      expect(result.isSuccess).toBe(true);
    });

    it("should POST /api/Notification/Save with empty itemId and isUpdateRequest=false for new configs", async () => {
      vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });

      const result = await service.saveNotificationConfig({
        projectKey: "proj-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "SendAsync",
      });

      expect(http.post).toHaveBeenCalledWith(NOTIFICATION_SAVE_ENDPOINT, {
        name: "Test",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "SendAsync",
        itemId: "",
        isUpdateRequest: false,
      });
      expect(result.isSuccess).toBe(true);
    });
  });

  describe("saveNotificationConfig built-in fields", () => {
    const base = {
      projectKey: "proj-1",
      name: "Test",
      channelToNotify: 0,
      notificationType: 1,
      enablePersistence: true,
      notifyMethod: "SendAsync",
      itemId: "cfg-1",
    };

    it("sends only the new fields the caller set", async () => {
      vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });
      await service.saveNotificationConfig({
        ...base,
        isDisabled: false,
        description: null,
        importance: 2,
      });
      const body = vi.mocked(http.post).mock.calls[0][1] as Record<string, unknown>;
      expect(body).toMatchObject({ isDisabled: false, description: null, importance: 2 });
      expect(body).not.toHaveProperty("kind");
      expect(body).not.toHaveProperty("isBuiltIn");
      expect(body).not.toHaveProperty("sourceService");
    });

    it("returns the server refusal keys unchanged", async () => {
      vi.mocked(http.post).mockResolvedValue({
        isSuccess: false,
        errors: { field: "Built_In_Notification_Configuration_Is_Read_Only" },
      });
      const result = await service.saveNotificationConfig(base);
      expect(result.isSuccess).toBe(false);
      expect(result.errors).toEqual({ field: "Built_In_Notification_Configuration_Is_Read_Only" });
    });

    it("keeps rows with and without the new fields as the server sent them", async () => {
      vi.mocked(http.get).mockResolvedValue({
        isSuccess: true,
        totalCount: 2,
        configurations: [
          { itemId: "a", name: "Old", notifyMethod: "m" },
          { itemId: "b", name: "New", notifyMethod: "m", isBuiltIn: true, kind: 1, importance: 3 },
        ],
      });
      const result = await service.getNotificationConfigs({
        projectKey: "p",
        page: 0,
        pageSize: 10,
      });
      expect(result.configurations[0].isBuiltIn).toBeUndefined();
      expect(result.configurations[1]).toMatchObject({ isBuiltIn: true, kind: 1, importance: 3 });
    });
  });

  describe("deleteNotificationConfig refusal", () => {
    it("throws the errors when the server answers 200 with isSuccess false", async () => {
      vi.mocked(http.delete).mockResolvedValue({
        isSuccess: false,
        errors: { ItemId: "Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration" },
      });
      const refusal = service.deleteNotificationConfig("cfg-1");
      await expect(refusal).rejects.toBeInstanceOf(Error);
      await expect(refusal).rejects.toMatchObject({
        errors: { ItemId: "Only_Root_Tenant_Can_Manage_Built_In_Notification_Configuration" },
      });
    });
  });

  describe("getNotificationConfig", () => {
    it("should GET Notification/Get with itemId", async () => {
      vi.mocked(http.get).mockResolvedValue({
        itemId: "cfg-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 0,
        enablePersistence: true,
        notifyMethod: "SendAsync",
      });

      const result = await service.getNotificationConfig("cfg-1");

      expect(http.get).toHaveBeenCalledWith(`${NOTIFICATION_GET_ENDPOINT}?itemId=cfg-1`);
      expect(result.itemId).toBe("cfg-1");
    });
  });

  describe("deleteNotificationConfig", () => {
    it("should DELETE Notification/Delete with itemId", async () => {
      vi.mocked(http.delete).mockResolvedValue({ isSuccess: true, errors: null });

      await service.deleteNotificationConfig("cfg-1");

      expect(http.delete).toHaveBeenCalledWith(`${NOTIFICATION_DELETE_ENDPOINT}?itemId=cfg-1`);
    });
  });
});
