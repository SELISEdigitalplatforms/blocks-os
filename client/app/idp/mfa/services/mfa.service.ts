import { http } from '@/lib/http-client'
import { secretsService } from '@/services/secrets.service'
import type { IAPIResponse } from '@/models/api-response'
import {
  IGenerateUserMFA_OtpPayload,
  IGenerateUserMFA_OtpResponse,
  IGetConfigurationPayload,
  IGetConfigurationResponse,
  IConfigureUserMFAPayload,
  IConfigureUserMFAResponse,
  IMFAConfigurationSavePayload,
  IMFAConfigurationSaveResponse,
  IMFASecretResponse,
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
      .get<IMFASecretResponse[] | IAPIResponse<IMFASecretResponse[]>>(`${MFA_CONFIG_ENDPOINTS.GET}?secretKey=mfa&PageNumber=0&PageSize=10`)
      .then((response) => {
        const secrets = Array.isArray(response) ? response : (response.data ?? [])
        const secret = secrets?.[0]
        if (!secret) {
          return {
            enableMfa: false,
            mfaTemplate: { templateName: '', templateId: '' },
            projectKey: null,
            userMfaType: [],
          }
        }
        const kv = secret.keyValuePairs
        const userMfaType = Array.isArray(kv.userMfaType)
          ? kv.userMfaType.map(Number)
          : typeof kv.userMfaType === 'string'
            ? JSON.parse(kv.userMfaType)
            : []
        const mfaTemplate =
          typeof kv.mfaTemplate === 'string'
            ? JSON.parse(kv.mfaTemplate)
            : (kv.mfaTemplate ?? { templateName: '', templateId: '' })
        return {
          itemId: secret.itemId,
          enableMfa:
            typeof kv.enableMfa === 'string'
              ? kv.enableMfa === 'true'
              : Boolean(kv.enableMfa),
          userMfaType,
          mfaTemplate,
          projectKey: null,
        }
      })
  }

  getProfileMfaConfiguration(): Promise<IGetConfigurationResponse> {
    return http.get(PROFILE_MFA_CONFIG_ENDPOINTS.GET, undefined, {
      absoluteUrl: true,
    })
  }

  saveMFAConfiguration(
    payload: IMFAConfigurationSavePayload,
  ): Promise<IMFAConfigurationSaveResponse> {
    const keyValuePairs: Record<string, string> = {
      enableMfa: String(payload.enableMfa),
      userMfaType: JSON.stringify(payload.userMfaType),
    }
    if (payload.mfaTemplate)
      keyValuePairs.mfaTemplate = JSON.stringify(payload.mfaTemplate)
    return secretsService
      .save({
        secretKey: 'mfa',
        keyValuePairs,
        ...(payload.itemId ? { itemId: payload.itemId } : {}),
      })
      .then(() => ({ isSuccess: true, errors: null }))
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
