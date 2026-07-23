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
import { getRuntimeEnv } from "@/lib/runtime-env"

type PeopleInvitationResultProps = {
  success: string
  old: string
  error: string
  code: string
}

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "")

/**
 * IAM's OIDC activation page, e.g.
 * `https://iam.seliseblocks.com/oidc/activate/{tenantId}?code={key}&lang=en-US`.
 * This mirrors the link IAM itself sends from "Resend Activation", so a freshly invited
 * user completes account setup against IAM rather than the OS-hosted activation page.
 *
 * The tenant is the blocks-os IAM (root) tenant — `BLOCKS_X_BLOCKS_KEY` — because a
 * project-people invitee's identity and its activation `UserKeyMap` are created there,
 * NOT under the invited project's resource tenant. Validating against any other tenant
 * misses the keymap and fails with `Invalid_ActivationCode`. This is the same tenant the
 * People-list resend and the OS `/activate` page target.
 * Returns null when the IAM base URL or the tenant key is unavailable.
 */
const buildIamActivationUrl = (code: string): string | null => {
  const iamBaseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL")
  const tenant = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY")
  if (!iamBaseUrl || !tenant) return null

  const params = new URLSearchParams({ code, lang: "en-US" })
  return `${trimTrailingSlash(iamBaseUrl)}/oidc/activate/${tenant}?${params.toString()}`
}

const InvitationResultShell = ({
  title,
  message,
  buttonText,
  buttonTo,
  external = false,
}: {
  title: string
  message: string
  buttonText: string
  buttonTo: string
  /** When true, `buttonTo` is an absolute URL (e.g. IAM) reached via a full navigation, not client routing. */
  external?: boolean
}) => (
  <div className="flex min-h-screen flex-col items-center bg-background">
    <div className="mb-4 mt-[136px] p-4">
      <Logo src="/Logo.svg" width={128} height={54.931} />
    </div>
    <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl leading-9">Blocks OS</CardTitle>
        <CardDescription className="mt-4 text-xl font-semibold text-foreground">
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-muted-foreground">{message}</p>
        {external ? (
          <a href={buttonTo} className="mt-8 block">
            <Button className="w-full">{buttonText}</Button>
          </a>
        ) : (
          <Link to={buttonTo} className="mt-8 block">
            <Button className="w-full">{buttonText}</Button>
          </Link>
        )}
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
    // Prefer IAM's OIDC activation page. Fall back to the OS-hosted activation page only
    // when the IAM base URL / tenant key is unavailable.
    const iamActivationUrl = buildIamActivationUrl(code)
    if (iamActivationUrl) {
      return (
        <InvitationResultShell
          title="Invitation Accepted!"
          message="You have successfully accepted the invitation. The project has been shared with you. Please proceed to activate your account to get started."
          buttonText="Activate"
          buttonTo={iamActivationUrl}
          external
        />
      )
    }

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
