import { Logo } from "@/components/logo"
import { Button } from "@/components/ui-kits/button/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card"
import { Link } from "react-router-dom"

type PeopleInvitationResultProps = {
  success: string
  old: string
  error: string
  code: string
}

const InvitationResultShell = ({
  title,
  message,
  buttonText,
  buttonTo,
}: {
  title: string
  message: string
  buttonText: string
  buttonTo: string
}) => (
  <div className="flex min-h-screen flex-col items-center bg-background">
    <div className="mb-4 mt-[136px] p-4">
      <Logo src="/Logo.svg" width={128} height={54.931} />
    </div>
    <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl leading-9">Blocks Cloud</CardTitle>
        <CardDescription className="mt-4 text-xl font-semibold text-foreground">
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{message}</p>
        <Link to={buttonTo} className="mt-8 block">
          <Button className="w-full">{buttonText}</Button>
        </Link>
      </CardContent>
    </Card>
  </div>
)

export const PeopleInvitationResult = ({
  success,
  error,
  old,
  code,
}: PeopleInvitationResultProps) => {
  if (success === "0") {
    const errorMessage =
      error === "expired"
        ? "The invitation link has expired."
        : "An error occurred during invitation confirmation."

    return (
      <InvitationResultShell
        title="Failed"
        message={errorMessage}
        buttonText="Go back"
        buttonTo="/login"
      />
    )
  }

  if (old === "0") {
    const activateParams = new URLSearchParams({
      code,
      lang: "en-US",
    })
    return (
      <InvitationResultShell
        title="Invitation Accepted!"
        message="You have successfully accepted the invitation. The project has been shared with you. Please proceed to activate your account to get started."
        buttonText="Activate"
        buttonTo={`/activate?${activateParams.toString()}`}
      />
    )
  }

  return (
    <InvitationResultShell
      title="Invitation Accepted!"
      message="You have successfully accepted the invitation. The project has been shared with you."
      buttonText="Go to Console"
      buttonTo="/login"
    />
  )
}
