import { AuthPageShell } from "@/components/auth-page-shell/auth-page-shell"
import { ForgotPasswordForm } from "./forgot-password-form"

export const ForgotPassword = () => {
  return (
    <AuthPageShell badge="Forgot Password" title="Blocks Cloud">
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}
