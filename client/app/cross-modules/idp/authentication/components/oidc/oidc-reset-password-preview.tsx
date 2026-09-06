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
      <div className="flex flex-col gap-3 sm:gap-4">
        <PreviewField label={copy.passwordLabel} password />
        <PreviewField label={copy.confirmPasswordLabel} password />
      </div>
      <div className="mt-4 flex items-start gap-2 text-xs text-[var(--muted)] sm:mt-5">
        <span
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)] text-[10px] text-[var(--accent)]"
          aria-hidden
        >
          ✓
        </span>
        <p>{copy.logoutFromDevicesLabel}</p>
      </div>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
