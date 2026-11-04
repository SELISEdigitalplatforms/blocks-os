import { useT } from "@seliseblocks/genesis-os";
import {
  OidcPreviewShell,
  PreviewButton,
  PreviewField,
  PreviewHeading,
  PreviewSuccess,
  type OidcPagePreviewProps,
} from "./oidc-preview-shared";

export const OidcForgotPasswordPreview = (props: OidcPagePreviewProps) => {
  const { t } = useT("os.idp.oidc");
  const copy = props.template.pages.forgotPassword;
  return (
    <OidcPreviewShell {...props} pageLabel={t("OIDC_FORGOT_PASSWORD_PREVIEW.PAGE_LABEL")}>
      <PreviewHeading>{copy.heading}</PreviewHeading>
      <p className="mb-4 text-sm text-(--muted)">{copy.introText}</p>
      <PreviewField label={copy.emailLabel} />
      <PreviewButton>{copy.submitButton}</PreviewButton>
      <p className="mt-3 text-center text-xs text-(--accent) sm:mt-4">{copy.backToLoginButton}</p>
      <PreviewSuccess title={copy.successTitle} subtitle={copy.successSubtitle} />
    </OidcPreviewShell>
  );
};
