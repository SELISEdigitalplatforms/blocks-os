import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { apiSettingsService } from "./api-settings.service";
import { API_SETTINGS_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("ApiSettingsService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  describe("getEndpoints", () => {
    it("applies default paging and maps a PascalCase response", async () => {
      vi.mocked(http.post).mockResolvedValue({
        Page: 1,
        PageSize: 50,
        TotalPages: 2,
        TotalCount: 60,
        Data: [
          {
            ItemId: "e-1",
            Controller: "users",
            Method: "list",
            HttpMethod: "GET",
            IsCaptchaRequired: true,
          },
        ],
        Errors: null,
      });

      const result = await apiSettingsService.getEndpoints({});

      expect(http.post).toHaveBeenCalledWith(API_SETTINGS_ENDPOINTS.GET_LIST, {
        page: 0,
        pageSize: 100,
        filter: {},
      });
      expect(result.page).toBe(1);
      expect(result.totalCount).toBe(60);
      expect(result.data[0].itemId).toBe("e-1");
      // controller is capitalized
      expect(result.data[0].controller).toBe("Users");
      expect(result.data[0].isCaptchaRequired).toBe(true);
    });

    it("maps a camelCase response and defaults missing fields", async () => {
      vi.mocked(http.post).mockResolvedValue({
        data: [{ itemId: "e-2" }],
      });

      const result = await apiSettingsService.getEndpoints({
        page: 2,
        pageSize: 10,
        filter: { service: "iam" },
      });

      expect(http.post).toHaveBeenCalledWith(API_SETTINGS_ENDPOINTS.GET_LIST, {
        page: 2,
        pageSize: 10,
        filter: { service: "iam" },
      });
      expect(result.page).toBe(0);
      expect(result.data[0].itemId).toBe("e-2");
      expect(result.data[0].controller).toBe("");
      expect(result.data[0].organizationIds).toEqual([]);
    });

    it("returns an empty data array when the response has no data", async () => {
      vi.mocked(http.post).mockResolvedValue({});
      const result = await apiSettingsService.getEndpoints({});
      expect(result.data).toEqual([]);
    });
  });

  it("updateEndpoint POSTs the payload", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    const payload = { itemId: "e-1" } as never;
    await apiSettingsService.updateEndpoint(payload);
    expect(http.post).toHaveBeenCalledWith(API_SETTINGS_ENDPOINTS.UPDATE, payload);
  });

  it("bulkUpdate POSTs the payload", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    const payload = { items: [] } as never;
    await apiSettingsService.bulkUpdate(payload);
    expect(http.post).toHaveBeenCalledWith(API_SETTINGS_ENDPOINTS.BULK_UPDATE, payload);
  });

  it("removeEndpoints POSTs the payload", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    const payload = { itemIds: ["e-1"] } as never;
    await apiSettingsService.removeEndpoints(payload);
    expect(http.post).toHaveBeenCalledWith(API_SETTINGS_ENDPOINTS.REMOVE, payload);
  });
});
