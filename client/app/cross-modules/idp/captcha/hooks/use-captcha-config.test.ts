import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockCaptchaServiceFactory,
  mockGetCaptchaConfigPayload,
  mockCaptchaConfig,
  mockSaveCaptchaPayload,
  mockToggleCaptchaStatusPayload,
} from "../../test-utils/__mocks__";
import { captchaService } from "../services/captcha.service";
import {
  useGetCaptchaConfig,
  useSaveCaptcha,
  useToggleCaptchaConfigStatus,
} from "./use-captcha-config";

vi.mock("@blocks-idp/captcha/services/captcha.service", () => mockCaptchaServiceFactory());

describe("use-captcha-config hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useGetCaptchaConfig", () => {
    it("should fetch the captcha config successfully", async () => {
      vi.mocked(captchaService.getCaptchaConfig).mockResolvedValue(mockCaptchaConfig);

      const { result } = renderHook(() => useGetCaptchaConfig(mockGetCaptchaConfigPayload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCaptchaConfig);
      expect(captchaService.getCaptchaConfig).toHaveBeenCalledWith();
    });

    it("should not fetch when no project is selected", () => {
      renderHook(() => useGetCaptchaConfig({ projectKey: "" }), {
        wrapper: createWrapper(),
      });

      expect(captchaService.getCaptchaConfig).not.toHaveBeenCalled();
    });
  });

  describe("useSaveCaptcha", () => {
    it("should save captcha config successfully", async () => {
      vi.mocked(captchaService.saveCaptcha).mockResolvedValue(mockCaptchaConfig);

      const { result } = renderHook(() => useSaveCaptcha(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveCaptchaPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(captchaService.saveCaptcha).toHaveBeenCalledWith(
        mockSaveCaptchaPayload,
        expect.anything(),
      );
    });
  });

  describe("useToggleCaptchaConfigStatus", () => {
    it("should update captcha config status successfully", async () => {
      vi.mocked(captchaService.updateCaptchaConfigStatus).mockResolvedValue({
        ...mockCaptchaConfig,
        isEnable: false,
      });

      const { result } = renderHook(() => useToggleCaptchaConfigStatus(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockToggleCaptchaStatusPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(captchaService.updateCaptchaConfigStatus).toHaveBeenCalledWith(
        mockToggleCaptchaStatusPayload,
        expect.anything(),
      );
    });
  });
});
