import { AlertTriangle } from "lucide-react"
import { AuthPageShell } from "@/components/auth-page-shell/auth-page-shell"
import { Button } from "@/components/ui-kits/button/button"
import { ResetPasswordForm } from "./reset-password-form"

type ResetPasswordProps = {
  code?: string
  lang?: string
}

export const ResetPassword = ({ code }: ResetPasswordProps) => {
  if (!code) {
    return (
      <AuthPageShell
        badge="Invalid reset link"
        title="Blocks Cloud"
        subtitle="The reset code is missing or invalid. Please request a new reset link."
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <Button asChild className="mt-2 w-full rounded">
            <a href="/forgot-password">Request a new reset link</a>
          </Button>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      badge="Set a new password"
      title="Blocks Cloud"
      subtitle="Choose password to secure account"
    >
      <ResetPasswordForm code={code} />
    </AuthPageShell>
  )
}
