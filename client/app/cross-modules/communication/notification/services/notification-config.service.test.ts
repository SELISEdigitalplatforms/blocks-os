import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/lib/http-client";
import { secretsService } from "@/services/secrets.service";
import { SECRETS_ENDPOINTS } from "@/services/secrets.service";
import { NotificationConfigService } from "./notification-config.service";
import { NOTIFICATION_CONFIG_SECRET_KEY } from "../models/notification-config.model";

vi.mock("@/lib/http-client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/services/secrets.service", () => ({
  secretsService: {
    save: vi.fn(),
    delete: vi.fn(),
  },
  SECRETS_ENDPOINTS: {
    GETS: "/api/Secrets/Gets",
    SAVE: "/api/Secrets/Save",
    GET: "/api/Secrets/Get",
    DELETE: "/api/Secrets/Delete",
  },
}));

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
    it("should GET with secretKey, pagination, and map configurations", async () => {
      vi.mocked(http.get).mockResolvedValue([
        {
          itemId: "cfg-1",
          secretKey: NOTIFICATION_CONFIG_SECRET_KEY,
          keyValuePairs: {
            name: "Test",
            channelToNotify: "0",
            notificationType: "0",
            enablePersistence: "true",
            notifyMethod: "SendAsync",
          },
        },
      ]);

      const result = await service.getNotificationConfigs({
        projectKey: "proj-1",
        page: 0,
        pageSize: 10,
      });

      expect(http.get).toHaveBeenCalledWith(
        `${SECRETS_ENDPOINTS.GETS}?secretKey=${NOTIFICATION_CONFIG_SECRET_KEY}&PageSize=10&PageNumber=0`,
      );
      expect(result.configurations[0]).toMatchObject({
        itemId: "cfg-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 0,
        enablePersistence: true,
        notifyMethod: "SendAsync",
      });
    });
  });

  describe("saveNotificationConfig", () => {
    it("should save via secretsService with string keyValuePairs", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({ itemId: "cfg-1" } as never);

      const result = await service.saveNotificationConfig({
        projectKey: "proj-1",
        name: "Test",
        channelToNotify: 0,
        notificationType: 1,
        enablePersistence: true,
        notifyMethod: "SendAsync",
        itemId: "cfg-1",
      });

      expect(secretsService.save).toHaveBeenCalledWith({
        secretKey: NOTIFICATION_CONFIG_SECRET_KEY,
        keyValuePairs: {
          name: "Test",
          channelToNotify: "0",
          notificationType: "1",
          enablePersistence: "true",
          notifyMethod: "SendAsync",
        },
        itemId: "cfg-1",
      });
      expect(result.isSuccess).toBe(true);
    });
  });
});
