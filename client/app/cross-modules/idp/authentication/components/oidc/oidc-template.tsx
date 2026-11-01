import { useT } from "@seliseblocks/genesis-os";

export default function OidcTemplate() {
  const { t } = useT("os.idp.oidc");
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h4 className="text-sm md:text-xl font-semibold">{t("OIDC_TEMPLATE.TITLE")}</h4>
      <p className="mt-2 text-muted-foreground">{t("OIDC_TEMPLATE.DESCRIPTION")}</p>
    </div>
  );
}
