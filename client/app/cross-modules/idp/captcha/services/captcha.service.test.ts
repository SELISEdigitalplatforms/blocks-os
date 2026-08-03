import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { secretsService } from "@/services/secrets.service";
import { CaptchaService } from "./captcha.service";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockGetCaptchaConfigsPayload,
  mockSaveCaptchaPayload,
  mockUpdateCaptchaStatusPayload,
  MOCK_CAPTCHA_ITEM_ID,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/services/secrets.service", () => ({
  secretsService: { save: vi.fn() },
}));

// Raw secret record as returned by the Secrets API.
const mockCaptchaSecret = {
  itemId: MOCK_CAPTCHA_ITEM_ID,
  createdDate: "2026-01-15T10:00:00Z",
  lastUpdatedDate: "2026-01-15T10:00:00Z",
  createdBy: "admin",
  lastUpdatedBy: "admin",
  organizationIds: [],
  tags: [],
  keyValuePairs: {
    captchaKey: "6Le-mock-captcha-key",
    captchaSecret: "6Le-mock-captcha-secret",
    provider: "recaptcha",
    captchaGenerator: "EasyCaptchaGenerator",
    isEnable: "true",
  },
};

describe("CaptchaService", () => {
  let service: CaptchaService;

  beforeEach(() => {
    service = new CaptchaService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getCaptchaConfigs ────────────────────────────────────────────────────
  describe("getCaptchaConfigs", () => {
    it("should GET the captcha secrets and map them into configurations", async () => {
      vi.mocked(http.get).mockResolvedValue([mockCaptchaSecret]);

      const result = await service.getCaptchaConfigs();

      expect(http.get).toHaveBeenCalledWith(
        `${CAPTCHA_ENDPOINTS.GETS}?secretKey=captcha&PageNumber=0&PageSize=10`,
      );
      expect(result).toEqual({
        configurations: [
          {
            itemId: MOCK_CAPTCHA_ITEM_ID,
            createdDate: "2026-01-15T10:00:00Z",
            lastUpdatedDate: "2026-01-15T10:00:00Z",
            createdBy: "admin",
            lastUpdatedBy: "admin",
            organizationIds: [],
            tags: [],
            captchaKey: "6Le-mock-captcha-key",
            captchaSecret: "6Le-mock-captcha-secret",
            provider: "recaptcha",
            captchaGenerator: "EasyCaptchaGenerator",
            isEnable: true,
          },
        ],
      });
    });

    it("should unwrap an IAPIResponse-wrapped secrets list", async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [mockCaptchaSecret] });

      const result = await service.getCaptchaConfigs();

      expect(result.configurations).toHaveLength(1);
      expect(result.configurations[0].isEnable).toBe(true);
    });

    it("should return an empty configurations list when there are no secrets", async () => {
      vi.mocked(http.get).mockResolvedValue([]);

      const result = await service.getCaptchaConfigs();

      expect(result).toEqual({ configurations: [] });
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getCaptchaConfigs()).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── saveCaptcha ──────────────────────────────────────────────────────────
  describe("saveCaptcha", () => {
    it("should save the captcha secret and return the item id", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({
        itemId: MOCK_CAPTCHA_ITEM_ID,
      } as never);

      const result = await service.saveCaptcha(mockSaveCaptchaPayload);

      expect(secretsService.save).toHaveBeenCalledWith({
        secretKey: "captcha",
        keyValuePairs: {
          isEnable: "true",
          provider: mockSaveCaptchaPayload.provider,
          captchaKey: mockSaveCaptchaPayload.captchaKey,
          captchaSecret: mockSaveCaptchaPayload.captchaSecret,
          captchaGenerator: mockSaveCaptchaPayload.captchaGenerator,
        },
      });
      expect(result).toEqual({
        isSuccess: true,
        errors: null,
        itemId: MOCK_CAPTCHA_ITEM_ID,
      });
    });

    it("should include the itemId when updating an existing secret", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({
        itemId: MOCK_CAPTCHA_ITEM_ID,
      } as never);

      await service.saveCaptcha({
        ...mockSaveCaptchaPayload,
        itemId: MOCK_CAPTCHA_ITEM_ID,
      });

      expect(secretsService.save).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: MOCK_CAPTCHA_ITEM_ID }),
      );
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(secretsService.save).mockRejectedValue(new Error("Network error"));

      await expect(service.saveCaptcha(mockSaveCaptchaPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── updateCaptchaConfigStatus ────────────────────────────────────────────
  describe("updateCaptchaConfigStatus", () => {
    it("should save the captcha secret with the toggled status", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({
        itemId: MOCK_CAPTCHA_ITEM_ID,
      } as never);

      const result = await service.updateCaptchaConfigStatus(mockUpdateCaptchaStatusPayload);

      expect(secretsService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          secretKey: "captcha",
          itemId: MOCK_CAPTCHA_ITEM_ID,
          keyValuePairs: expect.objectContaining({ isEnable: "false" }),
        }),
      );
      expect(result).toEqual({
        isSuccess: true,
        errors: null,
        itemId: MOCK_CAPTCHA_ITEM_ID,
      });
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(secretsService.save).mockRejectedValue(new Error("Network error"));

      await expect(
        service.updateCaptchaConfigStatus(mockUpdateCaptchaStatusPayload),
      ).rejects.toThrow("Network error");
    });
  });
});
