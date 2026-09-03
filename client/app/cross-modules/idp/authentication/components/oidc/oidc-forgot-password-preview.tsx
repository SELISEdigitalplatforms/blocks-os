import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcForgotPasswordPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.forgotPassword;
  return (
    <OidcPreviewShell {...props} pageLabel="Forgot Password">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <PreviewField label={copy.emailLabel} />
      <PreviewButton>{copy.submitButton}</PreviewButton>
    </OidcPreviewShell>
  );
};
