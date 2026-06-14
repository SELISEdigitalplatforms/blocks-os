import { useSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config"
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state"
import { ConfigFieldGrid } from "@blocks-idp/settings/components/config-field-grid"
import { ConfigLoadingState } from "@blocks-idp/settings/components/config-loading-state"
import { ConfigReadOnlyCard } from "@blocks-idp/settings/components/config-read-only-card"
import { useSettingsTenantId } from "@blocks-idp/settings/hooks/use-settings-tenant-id"
import {
  formatBoolean,
  formatList,
  formatMinutes,
  formatText,
} from "@blocks-idp/settings/utils/format-config"

export const AuthConfigTab = () => {
  const tenantId = useSettingsTenantId()
  const { data, isLoading, isFetching, isError } = useSettingsAuthConfig(tenantId)

  if (!tenantId) {
    return <ConfigErrorState message="Select a project to load authentication configuration." />
  }

  if (isLoading || isFetching) {
    return <ConfigLoadingState fieldCount={18} />
  }

  if (isError || !data) {
    return <ConfigErrorState />
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConfigReadOnlyCard title="Token & Session">
        <ConfigFieldGrid
          fields={[
            {
              label: "Access Token Valid For",
              value: formatMinutes(data.accessTokenValidForNumberMinutes),
            },
            {
              label: "Refresh Token Valid For",
              value: formatMinutes(data.refreshTokenValidForNumberMinutes),
            },
            {
              label: "Absolute Refresh Token Valid For",
              value: formatMinutes(data.absoluteRefreshTokenValidForNumberMinutes),
            },
            {
              label: "Remember Me Refresh Token Valid For",
              value: formatMinutes(data.rememberMeRefreshTokenValidForNumberMinutes),
            },
          ]}
        />
      </ConfigReadOnlyCard>

      <ConfigReadOnlyCard title="Account Security">
        <ConfigFieldGrid
          fields={[
            {
              label: "Wrong Attempts Before Lock",
              value: formatText(data.getNumberOfWrongAttemptsToLockTheAccount),
            },
            {
              label: "Account Lock Duration",
              value: formatMinutes(data.accountLockDurationInMinutes),
            },
            { label: "Public Certificate Path", value: formatText(data.publicCertificatePath) },
            { label: "OIDC Enabled", value: formatBoolean(data.isOidcEnabled) },
            {
              label: "Allowed Grant Types",
              value: formatList(data.allowedGrantTypes),
            },
            {
              label: "Password Strength Regex",
              value: data.passwordStrengthCheckerRegex ? (
                <code className="break-all rounded bg-muted px-1.5 py-0.5 text-sm">
                  {data.passwordStrengthCheckerRegex}
                </code>
              ) : (
                "—"
              ),
            },
          ]}
        />
      </ConfigReadOnlyCard>

      <ConfigReadOnlyCard title="Account Actions">
        <ConfigFieldGrid
          fields={[
            { label: "Account Activation Path", value: formatText(data.accountActivationPath) },
            { label: "Account Verification Path", value: formatText(data.accountVerificationPath) },
            { label: "Recover Account Path", value: formatText(data.recoverAccountPath) },
            { label: "Account Action Base URL", value: formatText(data.accountActionBaseUrl) },
            {
              label: "Use Account Action Base URL as Default",
              value: formatBoolean(data.useAccountActionBaseUrlAsDefault),
            },
            {
              label: "Activation URL Lifetime",
              value: formatMinutes(data.activationUrlLifetimeInMinutes),
            },
            {
              label: "Recover Account URL Lifetime",
              value: formatMinutes(data.recoverAccountUrlLifetimeInMinutes),
            },
            {
              label: "Logout on Password Change",
              value: formatBoolean(data.logoutOnPasswordChange),
            },
          ]}
        />
      </ConfigReadOnlyCard>
    </div>
  )
}
