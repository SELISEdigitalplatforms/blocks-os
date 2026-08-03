import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { MFAService } from "./mfa.service";
import {
  MFA_CONFIG_ENDPOINTS,
  MFA_ENDPOINTS,
  PROFILE_MFA_CONFIG_ENDPOINTS,
} from "../constants/endpoint.constant";
import {
  mockMfaConfigResponse,
  mockSaveMfaConfigPayload,
  mockGenerateOtpPayload,
  mockGenerateOtpResponse,
  mockConfigureUserMfaPayload,
  mockSetupTotpPayload,
  mockSetupTotpResponse,
  mockVerifyOtpPayload,
  mockVerifyOtpResponse,
  mockResendOtpPayload,
  mockDisableMfaPayload,
  mockSuccessResponse,
} from "../../test-utils/__mocks__";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("MFAService", () => {
  let service: MFAService;

  beforeEach(() => {
    service = new MFAService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getConfigurations (Mfa controller — secret-management admin UI) ──────
  describe("getConfigurations", () => {
    it("should map controller response to MFA configuration shape", async () => {
      vi.mocked(http.get).mockResolvedValue({
        enabled: true,
        allowedMethods: [1, 2],
        requireMfaForAllUsers: false,
        mfaRequiredRoles: [],
        mfaExemptRoles: [],
        allowUserOptOut: true,
        allowBackupCodes: true,
        backupCodesCount: 10,
        mfaTemplate: { templateName: "t", templateId: "id" },
      });

      const result = await service.getConfigurations();

      expect(http.get).toHaveBeenCalledWith(MFA_CONFIG_ENDPOINTS.GET, undefined, {
        absoluteUrl: true,
      });
      expect(result.enabled).toBe(true);
      expect(result.allowedMethods).toEqual([1, 2]);
    });
  });

  // ─── getProfileMfaConfiguration (Logic — profile page) ────────────────────
  describe("getProfileMfaConfiguration", () => {
    it("should GET MFA config from Logic API", async () => {
      vi.mocked(http.get).mockResolvedValue(mockMfaConfigResponse);

      const result = await service.getProfileMfaConfiguration();

      expect(http.get).toHaveBeenCalledWith(PROFILE_MFA_CONFIG_ENDPOINTS.GET, undefined, {
        absoluteUrl: true,
      });
      expect(result).toEqual(mockMfaConfigResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.getProfileMfaConfiguration()).rejects.toThrow("Network error");
    });
  });

  // ─── saveMFAConfiguration ─────────────────────────────────────────────────
  describe("saveMFAConfiguration", () => {
    it("should POST MFA configuration to the controller Save endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue({ isSuccess: true, errors: null });

      const result = await service.saveMFAConfiguration(mockSaveMfaConfigPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_CONFIG_ENDPOINTS.SAVE,
        {
          enableMfa: mockSaveMfaConfigPayload.enabled,
          userMfaType: mockSaveMfaConfigPayload.allowedMethods,
          mfaTemplate: mockSaveMfaConfigPayload.mfaTemplate,
        },
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual({ isSuccess: true, errors: null });
    });

    it("should throw when the controller Save call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.saveMFAConfiguration(mockSaveMfaConfigPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── generateUserMfaOTP ───────────────────────────────────────────────────
  describe("generateUserMfaOTP", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockGenerateOtpResponse);

      const result = await service.generateUserMfaOTP(mockGenerateOtpPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_ENDPOINTS.GENERATE_OTP,
        mockGenerateOtpPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockGenerateOtpResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.generateUserMfaOTP(mockGenerateOtpPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── configureUserMFA ─────────────────────────────────────────────────────
  describe("configureUserMFA", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.configureUserMFA(mockConfigureUserMfaPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_ENDPOINTS.CONFIGURE_USER_MFA,
        mockConfigureUserMfaPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.configureUserMFA(mockConfigureUserMfaPayload)).rejects.toThrow(
        "Network error",
      );
    });
  });

  // ─── setupUserTotp ────────────────────────────────────────────────────────
  describe("setupUserTotp", () => {
    it("should GET with correct query params", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSetupTotpResponse);

      const result = await service.setupUserTotp(mockSetupTotpPayload);

      expect(http.get).toHaveBeenCalledWith(
        `${MFA_ENDPOINTS.SETUP_TOTP}?UserId=${mockSetupTotpPayload.id}`,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSetupTotpResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.get).mockRejectedValue(new Error("Network error"));

      await expect(service.setupUserTotp(mockSetupTotpPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── verifyOtp ────────────────────────────────────────────────────────────
  describe("verifyOtp", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockVerifyOtpResponse);

      const result = await service.verifyOtp(mockVerifyOtpPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_ENDPOINTS.VERIFY_OTP,
        mockVerifyOtpPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockVerifyOtpResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.verifyOtp(mockVerifyOtpPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── resendOtp ────────────────────────────────────────────────────────────
  describe("resendOtp", () => {
    it("should POST the mfaId to the correct endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.resendOtp(mockResendOtpPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_ENDPOINTS.RESEND_OTP,
        mockResendOtpPayload.mfaId,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.resendOtp(mockResendOtpPayload)).rejects.toThrow("Network error");
    });
  });

  // ─── disableMFA ───────────────────────────────────────────────────────────
  describe("disableMFA", () => {
    it("should POST to the correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await service.disableMFA(mockDisableMfaPayload);

      expect(http.post).toHaveBeenCalledWith(
        MFA_ENDPOINTS.DISABLE_MFA,
        mockDisableMfaPayload,
        undefined,
        { absoluteUrl: true },
      );
      expect(result).toEqual(mockSuccessResponse);
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.disableMFA(mockDisableMfaPayload)).rejects.toThrow("Network error");
    });
  });
});
