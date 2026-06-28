import { getRuntimeEnv } from "@/lib/runtime-env"
import { z } from "zod"

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

export const getBlocksIamBaseUrl = () =>
  trimTrailingSlash(getRuntimeEnv("BLOCKS_IAM_BASE_URL"))

const positiveInt = z.coerce
  .number()
  .int({ message: "Must be a whole number." })
  .min(0, { message: "Must be zero or greater." })
  .max(2147483647, {
    message: "Value exceeds the allowed limit (0 - 2,147,483,647).",
  })

export const authSettingsFormSchema = z.object({
  accessTokenValidForNumberMinutes: positiveInt,
  refreshTokenValidForNumberMinutes: positiveInt,
  absoluteRefreshTokenValidForNumberMinutes: positiveInt,
  rememberMeRefreshTokenValidForNumberMinutes: positiveInt,
  getNumberOfWrongAttemptsToLockTheAccount: positiveInt,
  accountLockDurationInMinutes: positiveInt,
  publicCertificatePath: z.string(),
})

export const grantTypesFormSchema = z.object({
  allowedGrantTypes: z.array(z.string()).min(1, "Select at least one grant type."),
})

export type GrantTypesFormValues = z.infer<typeof grantTypesFormSchema>

export type AuthSettingsFormValues = z.infer<typeof authSettingsFormSchema>

export const iamConfigFormSchema = z.object({
  accountActivationPath: z.string(),
  accountVerificationPath: z.string(),
  recoverAccountPath: z.string(),
  accountActionBaseUrl: z.string(),
  useAccountActionBaseUrlAsDefault: z.boolean(),
  activationUrlLifetimeInMinutes: positiveInt,
  recoverAccountUrlLifetimeInMinutes: positiveInt,
  logoutOnPasswordChange: z.boolean(),
  isOidcEnabled: z.boolean(),
  passwordStrengthCheckerRegex: z.string(),
})

export type IamConfigFormValues = z.infer<typeof iamConfigFormSchema>

export const toAuthSettingsFormValues = (
  config: {
    accessTokenValidForNumberMinutes: number
    refreshTokenValidForNumberMinutes: number
    absoluteRefreshTokenValidForNumberMinutes: number
    rememberMeRefreshTokenValidForNumberMinutes: number
    getNumberOfWrongAttemptsToLockTheAccount: number
    accountLockDurationInMinutes: number
    publicCertificatePath: string
  },
): AuthSettingsFormValues => ({
  accessTokenValidForNumberMinutes: config.accessTokenValidForNumberMinutes,
  refreshTokenValidForNumberMinutes: config.refreshTokenValidForNumberMinutes,
  absoluteRefreshTokenValidForNumberMinutes: config.absoluteRefreshTokenValidForNumberMinutes,
  rememberMeRefreshTokenValidForNumberMinutes: config.rememberMeRefreshTokenValidForNumberMinutes,
  getNumberOfWrongAttemptsToLockTheAccount: config.getNumberOfWrongAttemptsToLockTheAccount,
  accountLockDurationInMinutes: config.accountLockDurationInMinutes,
  publicCertificatePath: config.publicCertificatePath,
})

export const toIamConfigFormValues = (
  config: {
    accountActivationPath: string
    accountVerificationPath: string
    recoverAccountPath: string
    accountActionBaseUrl: string
    useAccountActionBaseUrlAsDefault: boolean
    activationUrlLifetimeInMinutes: number
    recoverAccountUrlLifetimeInMinutes: number
    logoutOnPasswordChange: boolean
    isOidcEnabled: boolean
    passwordStrengthCheckerRegex: string
  },
): IamConfigFormValues => ({
  accountActivationPath: config.accountActivationPath,
  accountVerificationPath: config.accountVerificationPath,
  recoverAccountPath: config.recoverAccountPath,
  accountActionBaseUrl: config.accountActionBaseUrl,
  useAccountActionBaseUrlAsDefault: config.isOidcEnabled
    ? true
    : config.useAccountActionBaseUrlAsDefault,
  activationUrlLifetimeInMinutes: config.activationUrlLifetimeInMinutes,
  recoverAccountUrlLifetimeInMinutes: config.recoverAccountUrlLifetimeInMinutes,
  logoutOnPasswordChange: config.logoutOnPasswordChange,
  isOidcEnabled: config.isOidcEnabled,
  passwordStrengthCheckerRegex: config.passwordStrengthCheckerRegex,
})

export const applyOidcIamConfigOverrides = (
  values: IamConfigFormValues,
): IamConfigFormValues =>
  values.isOidcEnabled
    ? {
        ...values,
        useAccountActionBaseUrlAsDefault: false,
      }
    : values

export const buildSavePayload = (
  config: {
    itemId?: string
    refreshTokenValidForNumberMinutes: number
    absoluteRefreshTokenValidForNumberMinutes: number
    accessTokenValidForNumberMinutes: number
    rememberMeRefreshTokenValidForNumberMinutes: number
    getNumberOfWrongAttemptsToLockTheAccount: number
    accountLockDurationInMinutes: number
    publicCertificatePath: string
    accountActivationPath: string
    accountVerificationPath: string
    recoverAccountPath: string
    isOidcEnabled: boolean
    accountActionBaseUrl: string
    useAccountActionBaseUrlAsDefault: boolean
    activationUrlLifetimeInMinutes: number
    recoverAccountUrlLifetimeInMinutes: number
    logoutOnPasswordChange: boolean
    passwordStrengthCheckerRegex: string
    allowedGrantTypes: string[]
  },
  overrides: Partial<{
    itemId?: string
    refreshTokenValidForNumberMinutes: number
    absoluteRefreshTokenValidForNumberMinutes: number
    accessTokenValidForNumberMinutes: number
    rememberMeRefreshTokenValidForNumberMinutes: number
    getNumberOfWrongAttemptsToLockTheAccount: number
    accountLockDurationInMinutes: number
    publicCertificatePath: string
    accountActivationPath: string
    accountVerificationPath: string
    recoverAccountPath: string
    isOidcEnabled: boolean
    accountActionBaseUrl: string
    useAccountActionBaseUrlAsDefault: boolean
    activationUrlLifetimeInMinutes: number
    recoverAccountUrlLifetimeInMinutes: number
    logoutOnPasswordChange: boolean
    passwordStrengthCheckerRegex: string
    allowedGrantTypes: string[]
  }>,
) => ({
  itemId: overrides.itemId ?? config.itemId ?? "",
  refreshTokenValidForNumberMinutes:
    overrides.refreshTokenValidForNumberMinutes ?? config.refreshTokenValidForNumberMinutes,
  absoluteRefreshTokenValidForNumberMinutes:
    overrides.absoluteRefreshTokenValidForNumberMinutes ??
    config.absoluteRefreshTokenValidForNumberMinutes,
  accessTokenValidForNumberMinutes:
    overrides.accessTokenValidForNumberMinutes ?? config.accessTokenValidForNumberMinutes,
  rememberMeRefreshTokenValidForNumberMinutes:
    overrides.rememberMeRefreshTokenValidForNumberMinutes ??
    config.rememberMeRefreshTokenValidForNumberMinutes,
  getNumberOfWrongAttemptsToLockTheAccount:
    overrides.getNumberOfWrongAttemptsToLockTheAccount ??
    config.getNumberOfWrongAttemptsToLockTheAccount,
  accountLockDurationInMinutes:
    overrides.accountLockDurationInMinutes ?? config.accountLockDurationInMinutes,
  publicCertificatePath: overrides.publicCertificatePath ?? config.publicCertificatePath,
  accountActivationPath: overrides.accountActivationPath ?? config.accountActivationPath,
  accountVerificationPath: overrides.accountVerificationPath ?? config.accountVerificationPath,
  recoverAccountPath: overrides.recoverAccountPath ?? config.recoverAccountPath,
  isOidcEnabled: overrides.isOidcEnabled ?? config.isOidcEnabled,
  accountActionBaseUrl: overrides.accountActionBaseUrl ?? config.accountActionBaseUrl,
  useAccountActionBaseUrlAsDefault:
    overrides.useAccountActionBaseUrlAsDefault ?? config.useAccountActionBaseUrlAsDefault,
  activationUrlLifetimeInMinutes:
    overrides.activationUrlLifetimeInMinutes ?? config.activationUrlLifetimeInMinutes,
  recoverAccountUrlLifetimeInMinutes:
    overrides.recoverAccountUrlLifetimeInMinutes ?? config.recoverAccountUrlLifetimeInMinutes,
  logoutOnPasswordChange: overrides.logoutOnPasswordChange ?? config.logoutOnPasswordChange,
  passwordStrengthCheckerRegex:
    overrides.passwordStrengthCheckerRegex ?? config.passwordStrengthCheckerRegex,
  allowedGrantTypes: overrides.allowedGrantTypes ?? config.allowedGrantTypes,
})
