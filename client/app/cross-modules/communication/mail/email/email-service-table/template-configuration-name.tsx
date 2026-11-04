import { useT } from "@seliseblocks/genesis-os";
import type { IEmailConfig, IEmailTemplate } from "@blocks-communication/mail/models/email";
import { organizationOf } from "@blocks-communication/mail/constants/organization";
import { resolveOrganizationDefault } from "@blocks-communication/mail/constants/template-organization";

/**
 * A template's configuration by name. "Organization default" (no configuration) also says which
 * configuration it resolves to, from the configurations already loaded (H7).
 */
export function TemplateConfigurationName({
  template,
  configs,
}: {
  template: IEmailTemplate;
  configs: IEmailConfig[];
}) {
  const { t } = useT("os.communication.mail");
  if (template.mailConfigurationId) {
    return (
      <div className="truncate">
        {configs.find((config) => config.itemId === template.mailConfigurationId)?.name ?? "-"}
      </div>
    );
  }
  const resolved = resolveOrganizationDefault(configs, organizationOf(template));
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate">{t("TEMPLATE_ORGANIZATION.ORGANIZATION_DEFAULT")}</span>
      {resolved ? (
        <span className="truncate text-xs text-low-emphasis">
          {t("TEMPLATE_ORGANIZATION.VIA", { name: resolved.name })}
        </span>
      ) : null}
    </div>
  );
}
