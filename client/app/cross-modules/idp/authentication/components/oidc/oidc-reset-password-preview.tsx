import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  PreviewSuccess,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcResetPasswordPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.resetPassword;
  return (
    <OidcPreviewShell {...props} pageLabel="Reset Password">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <div className="flex flex-col gap-3">
        <PreviewField label={copy.passwordLabel} password />
        <PreviewField label={copy.confirmPasswordLabel} password />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">☑ {copy.logoutFromDevicesLabel}</p>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
