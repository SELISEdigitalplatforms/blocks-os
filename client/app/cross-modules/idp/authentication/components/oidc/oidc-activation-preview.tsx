import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  PreviewSuccess,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcActivationPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.activation;
  const collectPassword = props.collectPasswordOnActivation !== false;
  return (
    <OidcPreviewShell {...props} pageLabel="Activation">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <div className="flex flex-col gap-3 sm:gap-4">
        <PreviewField label="First Name" />
        {collectPassword ? (
          <>
            <PreviewField label={copy.passwordLabel} password />
            <PreviewField label={copy.confirmPasswordLabel} password />
          </>
        ) : null}
      </div>
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
