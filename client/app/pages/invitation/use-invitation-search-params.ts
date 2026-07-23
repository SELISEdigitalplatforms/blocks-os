import { getTrimmedSearchParam } from "@/lib/search-params"
import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"

export type InvitationResultSearchParams = {
  success: string
  old: string
  error: string
  /** Activation key from accept API (query name `code` on `/invitation/result`). */
  code: string
  /** Invited project's IAM tenant, used to build the IAM OIDC activation URL (query name `tenant`). */
  tenant: string
}

/** Invitation email link: `/invitation?code=...` */
export const useInvitationConfirmCode = () => {
  const [searchParams] = useSearchParams()

  return useMemo(() => {
    const code = getTrimmedSearchParam(searchParams, "code")
    return { code, isValid: code.length > 0 }
  }, [searchParams])
}

/** Post-accept screen: `/invitation/result?success=&old=&error=&code=` */
export const useInvitationResultSearchParams = (): InvitationResultSearchParams => {
  const [searchParams] = useSearchParams()

  return useMemo(
    () => ({
      success: getTrimmedSearchParam(searchParams, "success"),
      old: getTrimmedSearchParam(searchParams, "old"),
      error: getTrimmedSearchParam(searchParams, "error"),
      code: getTrimmedSearchParam(searchParams, "code"),
      tenant: getTrimmedSearchParam(searchParams, "tenant"),
    }),
    [searchParams],
  )
}

export const buildInvitationResultPath = (params: Record<string, string>) => {
  const search = new URLSearchParams(params)
  return `/invitation/result?${search.toString()}`
}
