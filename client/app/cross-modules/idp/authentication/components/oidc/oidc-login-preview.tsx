import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcLoginPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.login;
  return (
    <OidcPreviewShell {...props} pageLabel="Login">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <div className="flex flex-col gap-4">
        <PreviewField label={copy.emailLabel} />
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="oidc-sci-fi-label">{copy.passwordLabel}</span>
            <span className="oidc-sci-fi-link text-xs">{copy.forgotPasswordLink}</span>
          </div>
          <PreviewField label="" password />
        </div>
        <PreviewButton>{copy.submitButton}</PreviewButton>
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        {copy.signupPrompt} <span className="oidc-sci-fi-link">{copy.signupLink}</span>
      </p>
      <div className="mt-4 rounded-lg border border-[var(--border-strong)] p-3">
        <p className="text-sm font-semibold text-[var(--danger)]">{copy.activationErrorTitle}</p>
        <p className="mt-1 text-xs text-[var(--danger)]">{copy.activationErrorMessage}</p>
        <div className="mt-2 flex gap-2 text-xs text-[var(--accent)]">
          <span>{copy.activateAccountButton}</span>
          <span>·</span>
          <span>{copy.backToLoginButton}</span>
        </div>
      </div>
    </OidcPreviewShell>
  );
};
