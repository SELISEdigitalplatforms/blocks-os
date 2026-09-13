import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  PreviewSuccess,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcForgotPasswordPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.forgotPassword;
  return (
    <OidcPreviewShell {...props} pageLabel="Forgot Password">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <p className="mb-4 text-sm text-[var(--muted)]">{copy.introText}</p>
      <PreviewField label={copy.emailLabel} />
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <p className="mt-3 text-center text-xs text-[var(--accent)] sm:mt-4">
        {copy.backToLoginButton}
      </p>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
