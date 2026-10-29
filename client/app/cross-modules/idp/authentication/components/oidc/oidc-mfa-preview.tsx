import {
  OidcPreviewShell,
  PreviewButton,
  PreviewHeading,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcMfaPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.mfa;
  return (
    <OidcPreviewShell {...props} pageLabel="MFA">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <div className="flex min-w-0 justify-between gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className="flex h-11 min-w-0 flex-1 items-center justify-center rounded border border-(--border) text-(--fg) sm:max-w-11"
          >
            {index < 3 ? "•" : ""}
          </span>
        ))}
      </div>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      {copy.resendButton && (
        <p className="mt-4 text-center text-xs text-(--accent)">{copy.resendButton}</p>
      )}
    </OidcPreviewShell>
  );
};
