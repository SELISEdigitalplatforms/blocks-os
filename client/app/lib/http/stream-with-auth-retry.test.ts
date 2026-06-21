import { beforeEach, describe, expect, it, vi } from "vitest"
import { streamWithAuthRetry } from "./stream-with-auth-retry"

const mockStream = vi.fn()
const mockRefresh = vi.fn()

vi.mock("@/lib/http-client", () => ({
  http: {
    stream: (...args: unknown[]) => mockStream(...args),
  },
}))

vi.mock("@/lib/auth/refresh-oidc-session", () => ({
  refreshOidcSession: () => mockRefresh(),
}))

describe("streamWithAuthRetry", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should return stream on success without refreshing", async () => {
    const body = new ReadableStream<Uint8Array>()
    mockStream.mockResolvedValue(body)

    const result = await streamWithAuthRetry("/stream", { query: "hello" })

    expect(result).toBe(body)
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockStream).toHaveBeenCalledTimes(1)
  })

  it("should refresh and retry once on 401", async () => {
    const body = new ReadableStream<Uint8Array>()
    mockStream
      .mockRejectedValueOnce({ status: 401, errors: { general: "Unauthorized" } })
      .mockResolvedValueOnce(body)
    mockRefresh.mockResolvedValue(undefined)

    const result = await streamWithAuthRetry("/stream", { query: "hello" })

    expect(result).toBe(body)
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(mockStream).toHaveBeenCalledTimes(2)
    expect(mockStream).toHaveBeenLastCalledWith(
      "/stream",
      { query: "hello" },
      undefined,
      { skipTokenRotation: true },
    )
  })

  it("should not retry when skipTokenRotation is true", async () => {
    mockStream.mockRejectedValue({ status: 401, errors: { general: "Unauthorized" } })

    await expect(
      streamWithAuthRetry("/stream", { query: "hello" }, undefined, { skipTokenRotation: true }),
    ).rejects.toEqual({ status: 401, errors: { general: "Unauthorized" } })

    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockStream).toHaveBeenCalledTimes(1)
  })
})
