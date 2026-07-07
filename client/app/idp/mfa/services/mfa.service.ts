import { http } from '@/lib/http-client'
import type { MfaConfigControllerResponse } from '../models/mfa.model'
import {
  IGenerateUserMFA_OtpPayload,
  IGenerateUserMFA_OtpResponse,
  IGetConfigurationPayload,
  IGetConfigurationResponse,
  IConfigureUserMFAPayload,
  IConfigureUserMFAResponse,
  IMFAConfigurationSavePayload,
  IMFAConfigurationSaveResponse,
  ISetupUserTotpPayload,
  ISetupUserTotpResponse,
  IVerifyMfaOtpPayload,
  IVerifyMfaOtpResponse,
  IResendMfaOtpPayload,
  IDisableMFAResponse,
  IDisableMFAPayload,
} from '../models/mfa.model'
import {
  MFA_CONFIG_ENDPOINTS,
  MFA_ENDPOINTS,
  PROFILE_MFA_CONFIG_ENDPOINTS,
} from '../constants/endpoint.constant'

export class MFAService {
  getConfigurations(
    _payload?: IGetConfigurationPayload,
  ): Promise<IGetConfigurationResponse> {
    return http
      .get<MfaConfigControllerResponse>(MFA_CONFIG_ENDPOINTS.GET, undefined, {
        absoluteUrl: true,
      })
      .then((response) => ({
        enableMfa: response?.enableMfa ?? false,
        mfaTemplate: {
          templateName: response?.mfaTemplate?.templateName ?? '',
          templateId: response?.mfaTemplate?.templateId ?? '',
        },
        projectKey: null,
        userMfaType: Array.isArray(response?.userMfaType)
          ? response.userMfaType.map(Number)
          : [],
      }))
  }

  getProfileMfaConfiguration(): Promise<IGetConfigurationResponse> {
    return http.get(PROFILE_MFA_CONFIG_ENDPOINTS.GET, undefined, {
      absoluteUrl: true,
    })
  }

  saveMFAConfiguration(
    payload: IMFAConfigurationSavePayload,
  ): Promise<IMFAConfigurationSaveResponse> {
    return http
      .post<unknown>(
        MFA_CONFIG_ENDPOINTS.SAVE,
        {
          enableMfa: payload.enableMfa,
          userMfaType: payload.userMfaType,
          ...(payload.mfaTemplate ? { mfaTemplate: payload.mfaTemplate } : {}),
          projectKey: payload.projectKey,
        },
        undefined,
        { absoluteUrl: true },
      )
      .then((response) => {
        const body = (response ?? {}) as {
          isSuccess?: boolean;
          success?: boolean;
          errors?: unknown | null;
        };
        const isSuccess = body.isSuccess ?? body.success ?? true;
        return {
          isSuccess,
          errors: body.errors ?? null,
        };
      })
  }

  generateUserMfaOTP(
    payload: IGenerateUserMFA_OtpPayload,
  ): Promise<IGenerateUserMFA_OtpResponse> {
    return http.post(MFA_ENDPOINTS.GENERATE_OTP, payload, undefined, {
      absoluteUrl: true,
    })
  }

  configureUserMFA(
    payload: IConfigureUserMFAPayload,
  ): Promise<IConfigureUserMFAResponse> {
    return http.post(MFA_ENDPOINTS.CONFIGURE_USER_MFA, payload, undefined, {
      absoluteUrl: true,
    })
  }
  setupUserTotp(
    payload: ISetupUserTotpPayload,
  ): Promise<ISetupUserTotpResponse> {
    return http.get(
      `${MFA_ENDPOINTS.SETUP_TOTP}?UserId=${payload.id}`,
      undefined,
      { absoluteUrl: true },
    )
  }

  verifyOtp(payload: IVerifyMfaOtpPayload): Promise<IVerifyMfaOtpResponse> {
    return http.post(MFA_ENDPOINTS.VERIFY_OTP, payload, undefined, {
      absoluteUrl: true,
    })
  }

  resendOtp(payload: IResendMfaOtpPayload): Promise<IVerifyMfaOtpResponse> {
    return http.post(MFA_ENDPOINTS.RESEND_OTP, payload.mfaId, undefined, {
      absoluteUrl: true,
    })
  }
  disableMFA(payload: IDisableMFAPayload): Promise<IDisableMFAResponse> {
    return http.post(MFA_ENDPOINTS.DISABLE_MFA, payload, undefined, {
      absoluteUrl: true,
    })
  }
}

export const mfaService = new MFAService()
