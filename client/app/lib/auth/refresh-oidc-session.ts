import { getRuntimeEnv } from "@/lib/runtime-env"

const OIDC_TOKEN_PATH = "/api/oidc/token"

let refreshInFlight: Promise<void> | null = null

const performRefresh = async (): Promise<void> => {
  const tenantId = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY")
  const clientId = getRuntimeEnv("BLOCKS_OIDC_CLIENT_ID")
  const baseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL")

  if (!tenantId || !clientId || !baseUrl) {
    throw new Error("Missing OIDC refresh configuration")
  }

  const formData = new URLSearchParams()
  formData.append("grant_type", "refresh_token")
  formData.append("refresh_token", '""')
  formData.append("client_id", clientId)

  const url = `${baseUrl.replace(/\/$/, "")}${OIDC_TOKEN_PATH}?tenant_id=${tenantId}`

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Blocks-Key": tenantId,
    },
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`OIDC session refresh failed: HTTP ${response.status}`)
  }
}

export const refreshOidcSession = async (): Promise<void> => {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null
  })

  return refreshInFlight
}

export const resetRefreshOidcSessionForTests = (): void => {
  refreshInFlight = null
}
