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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <PreviewField label={copy.firstNameLabel} />
        <PreviewField label={copy.lastNameLabel} />
      </div>
      <div className="mt-3 sm:mt-4">
        <PreviewField label={copy.emailLabel} />
      </div>
      <div className="mt-4 flex items-start gap-2 text-xs text-[var(--muted)] sm:mt-5">
        <span
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)] text-[10px] text-[var(--accent)]"
          aria-hidden
        >
          ✓
        </span>
        <p>
          {copy.termsPrefix} <span className="text-[var(--accent)]">{copy.termsLinkText}</span> ·{" "}
          <span className="text-[var(--accent)]">{copy.privacyLinkText}</span>
        </p>
      </div>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <p className="mt-3 text-xs text-[var(--muted)] sm:mt-4">
        {copy.loginPrompt} <span className="text-[var(--accent)]">{copy.loginLink}</span>
      </p>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
