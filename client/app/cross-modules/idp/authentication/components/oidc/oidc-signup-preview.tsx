import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  PreviewSuccess,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcSignupPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.signup;
  return (
    <OidcPreviewShell {...props} pageLabel="Signup">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <div className="grid grid-cols-2 gap-3">
        <PreviewField label={copy.firstNameLabel} />
        <PreviewField label={copy.lastNameLabel} />
      </div>
      <div className="mt-3">
        <PreviewField label={copy.emailLabel} />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {copy.termsPrefix} <span className="text-[var(--accent)]">{copy.termsLinkText}</span> ·{" "}
        <span className="text-[var(--accent)]">{copy.privacyLinkText}</span>
      </p>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {copy.loginPrompt} <span className="text-[var(--accent)]">{copy.loginLink}</span>
      </p>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
