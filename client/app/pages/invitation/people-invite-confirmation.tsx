import { Logo } from "@/components/logo"
import { Button } from "@/components/ui-kits/button/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card"
import { usePeopleAcceptInvitation } from "@/hooks/use-people"
import { hasErrorCode, isErrorWithErrors } from "@/lib/error"
import { Link, useNavigate } from "react-router-dom"
import { buildInvitationResultPath } from "./use-invitation-search-params"

type PeopleInviteConfirmationProps = {
  code: string
}

export const PeopleInviteConfirmation = ({ code }: PeopleInviteConfirmationProps) => {
  const { mutateAsync, isPending } = usePeopleAcceptInvitation()
  const navigate = useNavigate()

  const handleAccept = async () => {
    try {
      const res = await mutateAsync({ code })
      if (!res.isSuccess) {
        const errorType = res.errors && hasErrorCode(res.errors, "code_expire") ? "expired" : "unknown"
        navigate(buildInvitationResultPath({ success: "0", error: errorType }), { replace: true })
        return
      }
      if (res.activationKey && res.activationKey.trim() !== "") {
        navigate(
          buildInvitationResultPath({
            success: "1",
            old: "0",
            code: res.activationKey,
          }),
          { replace: true },
        )
        return
      }
      navigate(buildInvitationResultPath({ success: "1", old: "1" }), { replace: true })
    } catch (error) {
      const errorType =
        isErrorWithErrors(error) && hasErrorCode(error.errors, "code_expire") ? "expired" : "unknown"
      navigate(buildInvitationResultPath({ success: "0", error: errorType }), { replace: true })
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <div className="mb-4 mt-[136px] p-4">
        <Logo src="/Logo.svg" width={128} height={54.931} />
      </div>
      <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl leading-9">Blocks Cloud</CardTitle>
          <CardDescription className="mt-4 text-xl font-semibold text-foreground">
            Accept Invitation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You have been invited to join a project. Click the button below to accept the
            invitation.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Button disabled={isPending} onClick={() => handleAccept()} className="w-full">
              Accept
            </Button>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                Go back
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
