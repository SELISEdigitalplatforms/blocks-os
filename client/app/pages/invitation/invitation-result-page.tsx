import { useSearchParams } from "react-router-dom"
import { PeopleInvitationResult } from "./people-invitation-result"

export const InvitationResultPage = () => {
  const [searchParams] = useSearchParams()

  return (
    <PeopleInvitationResult
      success={searchParams.get("success") ?? ""}
      old={searchParams.get("old") ?? ""}
      error={searchParams.get("error") ?? ""}
      code={searchParams.get("code") ?? ""}
    />
  )
}
