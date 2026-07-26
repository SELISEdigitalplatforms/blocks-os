import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/lib/http/http-client";
import { secretsService } from "@/services/secrets.service";
import { SECRETS_ENDPOINTS } from "@/services/secrets.service";
import { MagicUrlConfigService } from "./magic-url-config.service";
import { MAGIC_URL_CONFIG_SECRET_KEY } from "@blocks-utilities/models/magic-url-config.model";

vi.mock("@/lib/http/http-client", () => ({
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

describe("MagicUrlConfigService", () => {
  let service: MagicUrlConfigService;

  beforeEach(() => {
    service = new MagicUrlConfigService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMagicUrlConfigs", () => {
    it("should GET with secretKey, pagination, and map configurations", async () => {
      vi.mocked(http.get).mockResolvedValue([
        {
          itemId: "cfg-1",
          secretKey: MAGIC_URL_CONFIG_SECRET_KEY,
          keyValuePairs: {
            contextName: "Default",
            shortUrlBase: "https://short.example.com/",
          },
        },
      ]);

      const result = await service.getMagicUrlConfigs({
        projectKey: "proj-1",
        page: 0,
        pageSize: 10,
      });

      expect(http.get).toHaveBeenCalledWith(
        `${SECRETS_ENDPOINTS.GETS}?secretKey=${MAGIC_URL_CONFIG_SECRET_KEY}&PageSize=10&PageNumber=0`,
      );
      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0]).toMatchObject({
        itemId: "cfg-1",
        contextName: "Default",
        shortUrlBase: "https://short.example.com/",
      });
      expect(result.totalCount).toBe(1);
    });

    it("should append SearchText when provided", async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      await service.getMagicUrlConfigs({
        projectKey: "proj-1",
        page: 0,
        pageSize: 10,
        searchText: "dev-short",
      });

      expect(http.get).toHaveBeenCalledWith(
        `${SECRETS_ENDPOINTS.GETS}?secretKey=${MAGIC_URL_CONFIG_SECRET_KEY}&PageSize=10&PageNumber=0&SearchText=dev-short`,
      );
    });

    it("should return empty configurations when API returns no rows", async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      const result = await service.getMagicUrlConfigs({
        projectKey: "proj-1",
        page: 0,
        pageSize: 10,
      });

      expect(result).toEqual({ configurations: [], totalCount: 0 });
    });
  });

  describe("saveMagicUrlConfig", () => {
    it("should save via secretsService with captcha-style payload", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({ itemId: "cfg-1" } as never);

      const result = await service.saveMagicUrlConfig({
        projectKey: "proj-1",
        contextName: "Default",
        shortUrlBase: "https://short.example.com/",
        itemId: "cfg-1",
      });

      expect(secretsService.save).toHaveBeenCalledWith({
        secretKey: MAGIC_URL_CONFIG_SECRET_KEY,
        keyValuePairs: {
          contextName: "Default",
          shortUrlBase: "https://short.example.com/",
        },
        itemId: "cfg-1",
      });
      expect(result).toEqual({ isSuccess: true, errors: null, itemId: "cfg-1" });
    });
  });
});
