export interface IMFAConfiguration {
  enabled: boolean;
  allowedMethods: number[];
  requireMfaForAllUsers: boolean;
  mfaRequiredRoles: string[];
  mfaExemptRoles: string[];
  allowUserOptOut: boolean;
  allowBackupCodes: boolean;
  backupCodesCount: number;
  mfaTemplate?: { templateName: string; templateId: string };
  projectKey: string | null;
}

export interface IMFASecretKeyValuePairs {
  enabled?: boolean | string;
  allowedMethods?: number[] | string;
  requireMfaForAllUsers?: boolean | string;
  mfaRequiredRoles?: string[];
  mfaExemptRoles?: string[];
  allowUserOptOut?: boolean | string;
  allowBackupCodes?: boolean | string;
  backupCodesCount?: number;
  mfaTemplate?: { templateName: string; templateId: string } | string;
  enableMfa?: boolean | string;
  userMfaType?: number[] | string;
}

export interface IMFASecretResponse {
  secretKey: string;
  keyValuePairs: IMFASecretKeyValuePairs;
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
}

export interface IGetConfigurationPayload {
  projectKey: string;
}

export interface IMFAConfigurationSavePayload {
  enabled: boolean;
  allowedMethods: number[];
  requireMfaForAllUsers?: boolean;
  mfaRequiredRoles?: string[];
  mfaExemptRoles?: string[];
  allowUserOptOut?: boolean;
  allowBackupCodes?: boolean;
  backupCodesCount?: number;
  mfaTemplate?: {
    templateName: string;
    templateId: string;
  };
}
export interface IMFAConfigurationSaveResponse {
  errors: unknown | null;
  isSuccess: boolean;
}
export interface IGetConfigurationResponse extends IMFAConfiguration {
  itemId?: string;
}

export interface MfaConfigControllerResponse {
  enabled: boolean;
  allowedMethods: number[];
  requireMfaForAllUsers?: boolean;
  mfaRequiredRoles?: string[];
  mfaExemptRoles?: string[];
  allowUserOptOut?: boolean;
  allowBackupCodes?: boolean;
  backupCodesCount?: number;
  mfaTemplate?: { templateName: string; templateId: string };
}

export interface IConfigureUserMFAPayload {
  userId: string;
  mfaEnabled: boolean;
  userMfaType: number;
  projectKey: string;
}
export interface IConfigureUserMFAResponse {
  errors: unknown | null;
  isSuccess: boolean;
}
export interface ISetupUserTotpPayload {
  projectKey: string;
  id: string;
}
export interface ISetupUserTotpResponse {
  errors: unknown | null;
  isSuccess: boolean;
  qrImageUrl: string;
  qrCode: string;
}
export interface IGenerateUserMFA_OtpPayload {
  userId: string;
  projectKey: string;
  mfaType: number;
  sendPhoneNumberAsEmailDomain?: string;
}
export interface IGenerateUserMFA_OtpResponse {
  errors: unknown | null;
  isSuccess: boolean;
  mfaId: string;
}
export interface IVerifyMfaOtpPayload {
  mfaId: string;
  verificationCode: string;
  authType: number;
  projectKey: string;
  isFromTokenCall?: boolean;
}
export interface IVerifyMfaOtpResponse {
  errors: unknown;
  isSuccess: boolean;
  isValid: boolean;
  userId: string;
}
export interface IResendMfaOtpPayload {
  mfaId: string;
  sendPhoneNumberAsEmailDomain?: string;
}
export interface IVerifyMfaOtpResponse {
  errors: unknown;
  isSuccess: boolean;
  isValid: boolean;
  userId: string;
}
export interface IDisableMFAPayload {
  userId: string;
  projectKey: string;
}
export interface IDisableMFAResponse {
  errors: unknown;
  isSuccess: boolean;
}
