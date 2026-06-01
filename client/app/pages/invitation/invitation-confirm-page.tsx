import { Link } from "react-router-dom"
import { useInvitationConfirmCode } from "./use-invitation-search-params"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui-kits/button/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card"
import { PeopleInviteConfirmation } from "./people-invite-confirmation"

const InvitationMissingCode = () => (
  <div className="flex min-h-screen flex-col items-center bg-background">
    <div className="mb-4 mt-[136px] p-4">
      <Logo src="/Logo.svg" width={128} height={54.931} />
    </div>
    <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl leading-9">Blocks Cloud</CardTitle>
        <CardDescription className="mt-4 text-xl font-semibold text-foreground">
          Invalid invitation link
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">
          This invitation link is missing a confirmation code. Open the link from your invitation
          email or sign in if you already have an account.
        </p>
        <Link to="/login" className="mt-8 block">
          <Button className="w-full">Go to login</Button>
        </Link>
      </CardContent>
    </Card>
  </div>
)

export const InvitationConfirmPage = () => {
  const { code, isValid } = useInvitationConfirmCode()

  if (!isValid) {
    return <InvitationMissingCode />
  }

  return <PeopleInviteConfirmation code={code} />
}
