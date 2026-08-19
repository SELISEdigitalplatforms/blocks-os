import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { CaptchaService } from "./captcha.service";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";
import {
  mockCaptchaConfig,
  mockSaveCaptchaPayload,
  mockToggleCaptchaStatusPayload,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("CaptchaService", () => {
  let service: CaptchaService;

  beforeEach(() => {
    service = new CaptchaService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getCaptchaConfig ─────────────────────────────────────────────────────
  describe("getCaptchaConfig", () => {
    it("should GET the captcha configuration", async () => {
      vi.mocked(http.get).mockResolvedValue(mockCaptchaConfig);

      const result = await service.getCaptchaConfig();

      expect(http.get).toHaveBeenCalledWith(CAPTCHA_ENDPOINTS.GET);
      expect(result).toEqual(mockCaptchaConfig);
    });

    it("should resolve to null when nothing has been configured (404)", async () => {
      vi.mocked(http.get).mockRejectedValue({ status: 404 });

      const result = await service.getCaptchaConfig();

      expect(result).toBeNull();
    });

    it("should rethrow any other failure", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getCaptchaConfig()).rejects.toThrow("Network error");
    });
  });

  // ─── saveCaptcha ──────────────────────────────────────────────────────────
  describe("saveCaptcha", () => {
    it("should POST the payload and return the saved configuration", async () => {
      vi.mocked(http.post).mockResolvedValue(mockCaptchaConfig);

      const result = await service.saveCaptcha(mockSaveCaptchaPayload);

      expect(http.post).toHaveBeenCalledWith(CAPTCHA_ENDPOINTS.SAVE, mockSaveCaptchaPayload);
      expect(result).toEqual(mockCaptchaConfig);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.saveCaptcha(mockSaveCaptchaPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── updateCaptchaConfigStatus ────────────────────────────────────────────
  describe("updateCaptchaConfigStatus", () => {
    it("should POST the toggled status to the same save endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue({ ...mockCaptchaConfig, isEnable: false });

      const result = await service.updateCaptchaConfigStatus(mockToggleCaptchaStatusPayload);

      expect(http.post).toHaveBeenCalledWith(CAPTCHA_ENDPOINTS.SAVE, mockToggleCaptchaStatusPayload);
      expect(result.isEnable).toBe(false);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(
        service.updateCaptchaConfigStatus(mockToggleCaptchaStatusPayload),
      ).rejects.toThrow("Network error");
    });
  });

  // ─── deleteCaptchaConfig ──────────────────────────────────────────────────
  describe("deleteCaptchaConfig", () => {
    it("should DELETE the configuration", async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined);

      await service.deleteCaptchaConfig();

      expect(http.delete).toHaveBeenCalledWith(CAPTCHA_ENDPOINTS.DELETE);
    });
  });
});
