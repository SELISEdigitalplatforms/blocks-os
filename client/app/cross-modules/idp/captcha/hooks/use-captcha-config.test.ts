import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockCaptchaServiceFactory,
  mockGetCaptchaConfigPayload,
  mockCaptchaConfig,
  mockCaptchaConfigList,
  mockSaveCaptchaPayload,
  mockToggleCaptchaStatusPayload,
} from "../../test-utils/__mocks__";
import { captchaService } from "../services/captcha.service";
import {
  useGetCaptchaConfigList,
  useSaveCaptcha,
  useToggleCaptchaConfigStatus,
  useDeleteCaptcha,
} from "./use-captcha-config";

vi.mock("@blocks-idp/captcha/services/captcha.service", () => mockCaptchaServiceFactory());

describe("use-captcha-config hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useGetCaptchaConfigList", () => {
    it("should fetch the captcha config list successfully", async () => {
      vi.mocked(captchaService.getCaptchaConfigList).mockResolvedValue(mockCaptchaConfigList);

      const { result } = renderHook(() => useGetCaptchaConfigList(mockGetCaptchaConfigPayload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCaptchaConfigList);
      expect(captchaService.getCaptchaConfigList).toHaveBeenCalledWith();
    });

    it("should not fetch when no project is selected", () => {
      renderHook(() => useGetCaptchaConfigList({ projectKey: "" }), {
        wrapper: createWrapper(),
      });

      expect(captchaService.getCaptchaConfigList).not.toHaveBeenCalled();
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

  describe("useDeleteCaptcha", () => {
    it("should delete a captcha config successfully", async () => {
      vi.mocked(captchaService.deleteCaptchaConfig).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteCaptcha(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockCaptchaConfig.id);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(captchaService.deleteCaptchaConfig).toHaveBeenCalledWith(
        mockCaptchaConfig.id,
        expect.anything(),
      );
    });
  });
});
