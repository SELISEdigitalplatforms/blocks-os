import { refreshOidcSession } from "@/lib/auth/refresh-oidc-session"
import { http } from "@/lib/http-client"
import { isHttpErrorStatus } from "@/lib/http/http-error.util"

type StreamOptions = {
  absoluteUrl?: boolean
  skipBlocksKey?: boolean
  withCredentials?: boolean
  skipTokenRotation?: boolean
}

type HeadersInitValue = [string, string][] | Record<string, string> | Headers
type RequestBody = string | object | Array<unknown> | null | undefined

export const streamWithAuthRetry = async (
  url: string,
  body: RequestBody,
  headers?: HeadersInitValue,
  options?: StreamOptions,
): Promise<ReadableStream<Uint8Array>> => {
  try {
    return await http.stream(url, body, headers, options)
  } catch (error) {
    if (!isHttpErrorStatus(error, 401) || options?.skipTokenRotation) throw error

    await refreshOidcSession()
    return http.stream(url, body, headers, { ...options, skipTokenRotation: true })
  }
}
