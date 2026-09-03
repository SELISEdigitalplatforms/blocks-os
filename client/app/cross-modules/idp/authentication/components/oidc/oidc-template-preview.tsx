import type { IOidcUiTemplate } from "@blocks-idp/authentication/models/auth.oidc.model";
import { OidcAccountSelectorPreview } from "./oidc-account-selector-preview";
import { OidcActivationPreview } from "./oidc-activation-preview";
import { OidcForgotPasswordPreview } from "./oidc-forgot-password-preview";
import { OidcLoginPreview } from "./oidc-login-preview";
import { OidcMfaPreview } from "./oidc-mfa-preview";
import {
  type OidcPagePreviewProps,
  type OidcPreviewThemeMode,
  useResolvedPreviewTheme,
} from "./oidc-preview-shared";
import { OidcResetPasswordPreview } from "./oidc-reset-password-preview";
import { OidcSignupPreview } from "./oidc-signup-preview";
import type { OidcPageKey } from "./oidc-template-validation";

const PREVIEWS: Record<OidcPageKey, (props: OidcPagePreviewProps) => React.JSX.Element> = {
  login: OidcLoginPreview,
  signup: OidcSignupPreview,
  forgotPassword: OidcForgotPasswordPreview,
  resetPassword: OidcResetPasswordPreview,
  activation: OidcActivationPreview,
  mfa: OidcMfaPreview,
  accountSelector: OidcAccountSelectorPreview,
};

export const OidcTemplatePreview = ({
  template,
  selectedPage,
  previewMode,
  onPreviewModeChange,
  showAuto,
}: {
  template: IOidcUiTemplate;
  selectedPage: OidcPageKey;
  previewMode: OidcPreviewThemeMode;
  onPreviewModeChange: (mode: OidcPreviewThemeMode) => void;
  showAuto: boolean;
}) => {
  const resolvedTheme = useResolvedPreviewTheme(previewMode);
  const Preview = PREVIEWS[selectedPage];
  return (
    <Preview
      template={template}
      palette={template.theme[resolvedTheme]}
      resolvedTheme={resolvedTheme}
      previewMode={previewMode}
      onPreviewModeChange={onPreviewModeChange}
      showAuto={showAuto}
    />
  );
};
