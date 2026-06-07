import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { secretsService } from "@/services/secrets.service";
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

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

vi.mock("@/services/secrets.service", () => ({
  secretsService: {
    save: vi.fn(),
  },
}));

describe("MFAService", () => {
  let service: MFAService;

  beforeEach(() => {
    service = new MFAService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── getConfigurations (secrets — secret-management admin UI) ─────────────
  describe("getConfigurations", () => {
    it("should map secrets response to MFA configuration shape", async () => {
      vi.mocked(http.get).mockResolvedValue([
        {
          itemId: "mfa-1",
          keyValuePairs: {
            enableMfa: "true",
            userMfaType: "[1,2]",
            mfaTemplate: JSON.stringify({ templateName: "t", templateId: "id" }),
          },
        },
      ]);

      const result = await service.getConfigurations();

      expect(http.get).toHaveBeenCalledWith(`${MFA_CONFIG_ENDPOINTS.GET}?secretKey=mfa`);
      expect(result.enableMfa).toBe(true);
      expect(result.userMfaType).toEqual([1, 2]);
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
    it("should save via secretsService with MFA keyValuePairs", async () => {
      vi.mocked(secretsService.save).mockResolvedValue({ itemId: "mfa-1" } as never);

      const result = await service.saveMFAConfiguration(mockSaveMfaConfigPayload);

      expect(secretsService.save).toHaveBeenCalledWith({
        secretKey: "mfa",
        keyValuePairs: {
          enableMfa: "true",
          userMfaType: JSON.stringify(mockSaveMfaConfigPayload.userMfaType),
          mfaTemplate: JSON.stringify(mockSaveMfaConfigPayload.mfaTemplate),
        },
      });
      expect(result).toEqual({ isSuccess: true, errors: null });
    });

    it("should throw when secrets save fails", async () => {
      vi.mocked(secretsService.save).mockRejectedValue(new Error("Network error"));

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
