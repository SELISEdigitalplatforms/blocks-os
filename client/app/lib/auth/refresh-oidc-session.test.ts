import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  refreshOidcSession,
  resetRefreshOidcSessionForTests,
} from "./refresh-oidc-session"

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn((key: string) => {
    const env: Record<string, string> = {
      BLOCKS_X_BLOCKS_KEY: "test-tenant-id",
      BLOCKS_OIDC_CLIENT_ID: "test-client-id",
      BLOCKS_IAM_BASE_URL: "https://dev-iam.example.com",
    }
    return env[key] ?? ""
  }),
}))

describe("refreshOidcSession", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    resetRefreshOidcSessionForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("should call IAM oidc token endpoint with cookie-based refresh payload", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await refreshOidcSession()

    expect(fetch).toHaveBeenCalledWith(
      "https://dev-iam.example.com/api/oidc/token?tenant_id=test-tenant-id",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Blocks-Key": "test-tenant-id",
        },
      }),
    )

    const body = vi.mocked(fetch).mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get("grant_type")).toBe("refresh_token")
    expect(body.get("refresh_token")).toBe('""')
    expect(body.get("client_id")).toBe("test-client-id")
  })

  it("should dedupe concurrent refresh calls", async () => {
    let resolveFetch: (() => void) | undefined
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = () => resolve({ ok: true } as Response)
        }),
    )

    const first = refreshOidcSession()
    const second = refreshOidcSession()

    resolveFetch?.()
    await Promise.all([first, second])

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("should throw when refresh fails", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    await expect(refreshOidcSession()).rejects.toThrow("OIDC session refresh failed")
  })
})
