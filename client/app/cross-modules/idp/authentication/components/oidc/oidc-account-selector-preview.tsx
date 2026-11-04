import { useT } from "@seliseblocks/genesis-os";
import { OidcPreviewShell, PreviewHeading, type OidcPagePreviewProps } from "./oidc-preview-shared";

export const OidcAccountSelectorPreview = (props: OidcPagePreviewProps) => {
  const { t } = useT("os.idp.oidc");
  const copy = props.template.pages.accountSelector;
  const accounts = [
    t("OIDC_ACCOUNT_SELECTOR_PREVIEW.ACCOUNT_WORK"),
    t("OIDC_ACCOUNT_SELECTOR_PREVIEW.ACCOUNT_PERSONAL"),
  ];
  return (
    <OidcPreviewShell {...props} pageLabel={t("OIDC_ACCOUNT_SELECTOR_PREVIEW.PAGE_LABEL")}>
      <PreviewHeading>{copy.heading}</PreviewHeading>
      {copy.subheading && <p className="mb-4 text-sm text-(--muted) sm:mb-5">{copy.subheading}</p>}
      <p className="mb-3 text-sm text-(--muted)">{copy.bodyText}</p>
      <div className="space-y-3 sm:space-y-4">
        {accounts.map((account) => (
          <div
            key={account}
            className="rounded-lg border border-(--border) bg-(--accent-soft) p-4 text-sm text-(--fg)"
          >
            {account}
          </div>
        ))}
      </div>
    </OidcPreviewShell>
  );
};
