import { OidcPreviewShell, PreviewHeading, type OidcPagePreviewProps } from "./oidc-preview-shared";

export const OidcAccountSelectorPreview = (props: OidcPagePreviewProps) => {
  const copy = props.template.pages.accountSelector;
  return (
    <OidcPreviewShell {...props} pageLabel="Account Selector">
      <PreviewHeading>{copy.heading}</PreviewHeading>
      {copy.subheading && (
        <p className="mb-4 text-sm text-[var(--muted)] sm:mb-5">{copy.subheading}</p>
      )}
      <p className="mb-3 text-sm text-[var(--muted)]">{copy.bodyText}</p>
      <div className="space-y-3 sm:space-y-4">
        {["Work account", "Personal account"].map((account) => (
          <div
            key={account}
            className="rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--fg)]"
          >
            {account}
          </div>
        ))}
      </div>
    </OidcPreviewShell>
  );
};
